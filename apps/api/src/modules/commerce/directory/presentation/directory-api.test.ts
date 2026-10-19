import {
  ALL_LOCATIONS,
  CUSTOM_FIELD_TYPE,
  REDACTED_AUDIT_VALUE,
  SYSTEM_ROLE_KEY,
} from "@banijjik/contracts";
import { DIRECTORY_SEARCH_RULES, LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshIp } from "../../../../test-support/auth-api-client.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import { enableDirectoryForWorld } from "../../../../test-support/directory-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  // Empty tenantRouters forces the probe v1 router so the permissive template reader is used.
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

function listingField(input: {
  readonly fieldKey: string;
  readonly fieldType: string;
  readonly listingTier: string;
  readonly isRequired?: boolean;
  readonly isFilterable?: boolean;
  readonly options?: readonly string[];
  readonly sortOrder: number;
}) {
  return {
    entityType: "listing",
    fieldKey: input.fieldKey,
    fieldType: input.fieldType,
    label: { bn: input.fieldKey, en: input.fieldKey },
    isRequired: input.isRequired ?? false,
    visibility: { admin: true, storefront: true, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: input.sortOrder,
    listingTier: input.listingTier,
    ...(input.isFilterable === undefined ? {} : { isFilterable: input.isFilterable }),
    ...(input.options === undefined ? {} : { options: input.options }),
  };
}

async function aDirectoryWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  await enableDirectoryForWorld(world);
  const fields = [
    listingField({
      fieldKey: "age_band",
      fieldType: CUSTOM_FIELD_TYPE.SELECT,
      listingTier: LISTING_FIELD_TIER.PUBLIC,
      isRequired: true,
      isFilterable: true,
      options: ["20", "25", "30"],
      sortOrder: 1,
    }),
    listingField({
      fieldKey: "family_note",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      listingTier: LISTING_FIELD_TIER.MEMBERS,
      sortOrder: 2,
    }),
    listingField({
      fieldKey: "own_name",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      listingTier: LISTING_FIELD_TIER.PRIVATE,
      sortOrder: 3,
    }),
  ];
  for (const field of fields) {
    const created = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/custom-fields`,
      field,
    );
    if (created.status !== 201) {
      throw new Error(`custom field ${field.fieldKey} failed: ${created.status}`);
    }
  }
  return world;
}

describe("directory listings", () => {
  it("lets a customer create, submit and lets staff approve; public search hides private tiers", async () => {
    const world = await aDirectoryWorld();
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);

    const created = await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies,
      body: {
        customFields: {
          age_band: "25",
          family_note: "joint",
          own_name: "secret",
        },
      },
    });
    expect(created.status).toBe(200);
    expect(created.body.data.status).toBe("DRAFT");
    expect(created.body.data.customFields.own_name).toBe("secret");

    const submitted = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies,
      body: { consents: [] },
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe("SUBMITTED");

    const queue = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/queue?status=SUBMITTED`,
    );
    expect(queue.status).toBe(200);
    expect(queue.body.data.items).toHaveLength(1);
    const listingId = queue.body.data.items[0].listingId as string;
    const version = queue.body.data.items[0].version as number;

    const approved = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/approve`,
      { version },
    );
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");
    expect(approved.body.data.customFields.own_name).toBe("secret");

    const publicSearch = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
    });
    expect(publicSearch.status).toBe(200);
    expect(publicSearch.body.data.items).toHaveLength(1);
    expect(publicSearch.body.data.items[0].customFields).toEqual({ age_band: "25" });

    const memberSearch = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      cookies,
    });
    expect(memberSearch.body.data.items[0].customFields).toEqual({
      age_band: "25",
      family_note: "joint",
    });
  });

  it("refuses a customer of organization A at organization B and hides cross-org listings", async () => {
    const world = await aDirectoryWorld();
    const customerA = await signInCustomer(harness, world.organizationA);
    await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: asCustomerCookies(customerA.session),
      body: { customFields: { age_band: "25" } },
    });
    await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies: asCustomerCookies(customerA.session),
      body: { consents: [] },
    });
    const queue = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/queue?status=SUBMITTED`,
    );
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${queue.body.data.items[0].listingId}/approve`,
      { version: queue.body.data.items[0].version },
    );

    const cross = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationB,
      suffix: "/my/listing",
      cookies: asCustomerCookies(customerA.session),
    });
    expect(cross.status).toBe(401);

    const searchB = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationB,
      suffix: "/listings",
    });
    expect(searchB.status).toBe(200);
    expect(searchB.body.data.items).toEqual([]);
  });

  it("refuses photoFileIds when photo policy is NONE and refuses cross-org staff", async () => {
    const world = await aDirectoryWorld();
    const customer = await signInCustomer(harness, world.organizationA);
    const refused = await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: asCustomerCookies(customer.session),
      body: {
        customFields: { age_band: "25" },
        photoFileIds: [newId()],
      },
    });
    expect(refused.status).toBe(400);
    expect(refused.body.error.messageKey).toBe("errors.directory_photo_policy_none");

    // Non-members get the same 404 as an unknown org (ADR-080); never 403 that reveals membership.
    const crossOrg = await world.bob.call("get", `/orgs/${world.organizationA}/directory/queue`);
    expect(crossOrg.status).toBe(404);
  });

  it("filters approved listings and uses the attribute index", async () => {
    const world = await aDirectoryWorld();
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);
    await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies,
      body: { customFields: { age_band: "25" } },
    });
    await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies,
      body: { consents: [] },
    });
    const queue = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/queue?status=SUBMITTED`,
    );
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${queue.body.data.items[0].listingId}/approve`,
      { version: queue.body.data.items[0].version },
    );

    const hit = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      query: { "f.age_band": "25" },
    });
    const miss = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      query: { "f.age_band": "30" },
    });
    const refused = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      query: { "f.own_name": "secret" },
    });
    expect(hit.status).toBe(200);
    expect(hit.body.data.items).toHaveLength(1);
    expect(miss.body.data.items).toEqual([]);
    expect(refused.status).toBe(400);

    const plan = await harness.connections.tenantShared
      .collection("listings")
      .find({
        organizationId: world.organizationA,
        status: "APPROVED",
        customFieldSearch: { $elemMatch: { fieldKey: "age_band", value: "25" } },
      })
      .explain("queryPlanner");
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).not.toContain("COLLSCAN");
  });

  it("answers 429 once search scrapes past the per-IP limit", async () => {
    const world = await aDirectoryWorld();
    const ip = freshIp();
    let lastStatus = 0;
    for (let index = 0; index < DIRECTORY_SEARCH_RULES.perIp.limit + 1; index += 1) {
      const response = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/listings",
        ip,
      });
      lastStatus = response.status;
      if (response.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("refuses a viewer on review and redacts personal values in the audit log", async () => {
    const world = await aDirectoryWorld();
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);
    await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies,
      body: {
        customFields: { age_band: "25", own_name: "secret-name-xyz" },
      },
    });
    await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies,
      body: { consents: [] },
    });
    const queue = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/queue?status=SUBMITTED`,
    );
    const listingId = queue.body.data.items[0].listingId as string;
    const approved = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/approve`,
      { version: queue.body.data.items[0].version },
    );
    expect(approved.status).toBe(200);

    const viewerRole = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: viewerRole },
    ]);
    const denied = await viewer.actor.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/approve`,
      { version: approved.body.data.version },
    );
    expect(denied.status).toBe(403);

    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ entityId: listingId })
      .toArray();
    expect(audit.length).toBeGreaterThan(0);
    const blob = JSON.stringify(audit);
    expect(blob).not.toContain("secret-name-xyz");
    expect(blob).toContain(REDACTED_AUDIT_VALUE);
  });
});
