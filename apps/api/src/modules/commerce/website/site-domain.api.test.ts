import { ERROR_CODE, IDEMPOTENCY_KEY_HEADER, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { SITE_DOMAIN_STATUS, WEBSITE_EVENT_TYPE } from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type SiteDomainId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models } from "../../../kernel/db/index.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../../../kernel/events/outbox-event.schema.js";
import { createMongoHostClaims } from "../../platform/operations/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import { permissivePolicy, siteDesign } from "../../../test-support/site-fixtures.js";
import { asCookies, freshIp } from "../../../test-support/auth-api-client.js";
import { createTwoOrganizations, type ApiActor } from "../../../test-support/two-organizations.js";
import request from "supertest";
import { Site } from "./domain/site.entity.js";
import { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
import {
  SITE_DOMAIN_MODEL_NAME,
  type SiteDomainDocument,
} from "./infrastructure/site-domain.schema.js";

registerIamApiModels();

const TEST_RESERVATIONS = { baseDomain: "sites.example.com", reservedHostnames: [] as const };

let harness: IamApiHarness;
const hostClaims = createMongoHostClaims(TEST_RESERVATIONS);

beforeAll(async () => {
  harness = await startIamApi({
    environmentOverrides: { STOREFRONT_BASE_DOMAIN: TEST_RESERVATIONS.baseDomain },
  });
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld() {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function aHostname(label: string): string {
  return `${label}-${newId().replace(/-/g, "").slice(0, 12)}.example.com`;
}

function domainsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/website/domains${suffix}`;
}

async function insertDraftSite(organizationId: string, actorUserId: string): Promise<Site> {
  return withOrganizationContext(organizationId, async () => {
    const site = Site.create({
      organizationId: asId<OrganizationId>(organizationId),
      draftDesign: siteDesign(),
      editPolicy: permissivePolicy(),
      sourceTemplateKey: "retail-starter",
      sourceTemplateRevision: 1,
      now: new Date(),
      actorUserId: asId<UserId>(actorUserId),
    });
    const outcome = await new MongoSiteRepository().insert(site);
    if (outcome !== "inserted") throw new Error("site insert failed");
    return site;
  });
}

async function addDomain(actor: ApiActor, organizationId: string, hostname: string) {
  return actor.callWith({
    method: "post",
    path: domainsPath(organizationId),
    body: { hostname },
    idempotencyKey: newId(),
  });
}

/** callApi only attaches Idempotency-Key on POST; PATCH/DELETE still need it (Refresh A2-1). */
async function mutate(actor: ApiActor, method: "patch" | "delete", path: string, body?: object) {
  const cookies = Object.entries(asCookies(actor.person.session))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  const agent = request(harness.app);
  let pending = method === "patch" ? agent.patch(`/api/v1${path}`) : agent.delete(`/api/v1${path}`);
  pending = pending
    .set("Cookie", cookies)
    .set(IDEMPOTENCY_KEY_HEADER, newId())
    .set("X-Forwarded-For", freshIp());
  if (body !== undefined) pending = pending.send(body);
  return pending;
}

describe("website domain API", () => {
  it("gives exactly one claim when two organizations race for one hostname", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    await insertDraftSite(world.organizationB, world.bob.userId);
    const hostname = aHostname("race");
    const results = await Promise.all([
      addDomain(world.alice, world.organizationA, hostname),
      addDomain(world.bob, world.organizationB, hostname),
    ]);
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([202, 409]);
    const taken = results.find((result) => result.status === 409);
    expect(taken?.body.error.code).toBe(ERROR_CODE.WEBSITE_DOMAIN_TAKEN);
  });

  it("refuses a host with a suffix trick, a port, userinfo, or the reserved apex", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const refused = [
      "shop.example.com/path",
      "shop.example.com:443",
      "user@shop.example.com",
      "sites.example.com",
    ];
    for (const hostname of refused) {
      const response = await addDomain(world.alice, world.organizationA, hostname);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ERROR_CODE.WEBSITE_DOMAIN_INVALID);
    }
  });

  it("refuses cross-org manage and read, and a member who holds the permission at one location only", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const hostname = aHostname("cross");
    const created = await addDomain(world.alice, world.organizationA, hostname);
    expect(created.status).toBe(202);

    const otherOrg = await world.bob.call("get", domainsPath(world.organizationA));
    expect(otherOrg.status).toBe(404);

    const staff = await world.sam.call("get", domainsPath(world.organizationA));
    expect(staff.status).toBe(403);

    const ownerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.OWNER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: ownerRoleId },
    ]);
    const oneLocation = await actor.callWith({
      method: "post",
      path: domainsPath(world.organizationA),
      body: { hostname: aHostname("oneloc") },
      idempotencyKey: newId(),
    });
    expect(oneLocation.status).toBe(403);
  });

  it("refuses a stale version with 409 and replays a duplicate Idempotency-Key", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const hostname = aHostname("replay");
    const key = newId();
    const first = await world.alice.callWith({
      method: "post",
      path: domainsPath(world.organizationA),
      body: { hostname },
      idempotencyKey: key,
    });
    expect(first.status).toBe(202);
    const replay = await world.alice.callWith({
      method: "post",
      path: domainsPath(world.organizationA),
      body: { hostname },
      idempotencyKey: key,
    });
    expect(replay.status).toBe(202);
    expect(replay.body.data.siteDomainId).toBe(first.body.data.siteDomainId);

    const stale = await world.alice.callWith({
      method: "post",
      path: domainsPath(world.organizationA, `/${first.body.data.siteDomainId}/verify`),
      body: { version: 99 },
      idempotencyKey: newId(),
    });
    expect(stale.status).toBe(409);
  });

  it("answers 404 when the organization has no Site", async () => {
    const world = await aWorld();
    const response = await addDomain(world.alice, world.organizationA, aHostname("nosite"));
    expect(response.status).toBe(404);
  });

  it("moves a domain to VERIFYING and writes the outbox without calling a provider", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const created = await addDomain(world.alice, world.organizationA, aHostname("verify"));
    expect(created.status).toBe(202);
    const verified = await world.alice.callWith({
      method: "post",
      path: domainsPath(world.organizationA, `/${created.body.data.siteDomainId}/verify`),
      body: { version: created.body.data.version },
      idempotencyKey: newId(),
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
    const outbox = await models({})
      .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
      .find({
        type: WEBSITE_EVENT_TYPE.DOMAIN_VERIFICATION_REQUESTED,
        "payload.siteDomainId": created.body.data.siteDomainId,
      })
      .lean();
    expect(outbox).toHaveLength(1);
  });

  it("refuses delete when the claim generation has moved on", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const hostname = aHostname("stale-gen");
    const created = await addDomain(world.alice, world.organizationA, hostname);
    expect(created.status).toBe(202);
    await hostClaims.reserve({
      hostname,
      organizationId: asId<OrganizationId>(world.organizationA),
      siteDomainId: asId<SiteDomainId>(created.body.data.siteDomainId),
      operationGeneration: 2,
    });
    const deleted = await mutate(
      world.alice,
      "delete",
      `${domainsPath(world.organizationA, `/${created.body.data.siteDomainId}`)}?version=${created.body.data.version}`,
    );
    expect(deleted.status).toBe(409);
    const listed = await world.alice.call("get", domainsPath(world.organizationA));
    const row = listed.body.data.items.find(
      (item: { siteDomainId: string }) => item.siteDomainId === created.body.data.siteDomainId,
    );
    expect(row.status).toBe(SITE_DOMAIN_STATUS.PENDING);
  });

  it("refuses to select a non-ACTIVE domain as canonical and clears the pointer on delete", async () => {
    const world = await aWorld();
    const site = await insertDraftSite(world.organizationA, world.alice.userId);
    const created = await addDomain(world.alice, world.organizationA, aHostname("canon"));
    const pending = await mutate(
      world.alice,
      "patch",
      domainsPath(world.organizationA, `/${created.body.data.siteDomainId}`),
      {
        version: created.body.data.version,
        expectedSiteVersion: site.version,
        isCanonical: true,
      },
    );
    expect(pending.status).toBe(409);
    expect(pending.body.error.code).toBe(ERROR_CODE.WEBSITE_DOMAIN_NOT_READY);

    await withOrganizationContext(world.organizationA, async () => {
      await models({})
        .get<SiteDomainDocument>(SITE_DOMAIN_MODEL_NAME)
        .updateOne(
          { siteDomainId: created.body.data.siteDomainId },
          { $set: { status: SITE_DOMAIN_STATUS.ACTIVE } },
        );
    });
    const selected = await mutate(
      world.alice,
      "patch",
      domainsPath(world.organizationA, `/${created.body.data.siteDomainId}`),
      {
        version: created.body.data.version,
        expectedSiteVersion: site.version,
        isCanonical: true,
      },
    );
    expect(selected.status).toBe(200);
    expect(selected.body.data.isCanonical).toBe(true);

    const deleted = await mutate(
      world.alice,
      "delete",
      `${domainsPath(world.organizationA, `/${created.body.data.siteDomainId}`)}?version=${created.body.data.version}`,
    );
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.isCanonical).toBe(false);
    expect(deleted.body.data.status).toBe(SITE_DOMAIN_STATUS.REMOVING);
  });

  it("lists a page of this organization's hosts only", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    await insertDraftSite(world.organizationB, world.bob.userId);
    const hostA1 = aHostname("lista");
    const hostA2 = aHostname("listb");
    const hostB = aHostname("listc");
    expect((await addDomain(world.alice, world.organizationA, hostA1)).status).toBe(202);
    expect((await addDomain(world.alice, world.organizationA, hostA2)).status).toBe(202);
    expect((await addDomain(world.bob, world.organizationB, hostB)).status).toBe(202);

    const page = await world.alice.call(
      "get",
      `${domainsPath(world.organizationA)}?page=1&limit=1`,
    );
    expect(page.status).toBe(200);
    expect(page.body.data.total).toBe(2);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.limit).toBe(1);
    const hosts = [page.body.data.items[0].hostname];
    const rest = await world.alice.call(
      "get",
      `${domainsPath(world.organizationA)}?page=2&limit=1`,
    );
    hosts.push(rest.body.data.items[0].hostname);
    expect(hosts.sort()).toEqual([hostA1, hostA2].sort());
    expect(hosts).not.toContain(hostB);
  });
});
