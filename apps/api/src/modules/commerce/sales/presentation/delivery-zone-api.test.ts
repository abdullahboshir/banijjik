import { ERROR_CODE, IDEMPOTENCY_KEY_HEADER, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { DELIVERY_ZONE_STATUS } from "@banijjik/contracts/sales/delivery";
import { newId } from "@banijjik/ids";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, freshIp } from "../../../../test-support/auth-api-client.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { ApiActor, type TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ZONE_NAME = { bn: "ঢাকা উত্তর", en: "Dhaka North" } as const;
const FEE_MINOR = 8_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function zonesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/sales/delivery-zones${suffix}`;
}

function zoneBody(
  overrides: {
    readonly zoneKey?: string;
    readonly areaCodes?: readonly string[];
    readonly feeMinor?: number;
    readonly status?: "ACTIVE" | "INACTIVE";
  } = {},
) {
  return {
    zoneKey: overrides.zoneKey ?? `zone-${newId().slice(-12)}`,
    name: ZONE_NAME,
    areaCodes: overrides.areaCodes ?? [`area-${newId().slice(-10)}`],
    feeMinor: overrides.feeMinor ?? FEE_MINOR,
    status: overrides.status ?? DELIVERY_ZONE_STATUS.ACTIVE,
  };
}

function createZone(actor: ApiActor, organizationId: string, body: object, key?: string) {
  return actor.callWith({
    method: "post",
    path: zonesPath(organizationId),
    body,
    ...(key === undefined ? {} : { idempotencyKey: key }),
  });
}

function patchZone(
  actor: ApiActor,
  path: string,
  body: object,
  idempotencyKey: string | null = newId(),
) {
  const cookies = Object.entries(asCookies(actor.person.session))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  let pending = request(harness.app)
    .patch(`/api/v1${path}`)
    .set("Cookie", cookies)
    .set("X-Forwarded-For", freshIp());
  if (idempotencyKey !== null) pending = pending.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
  return pending.send(body);
}

async function everyZoneRoute(actor: ApiActor, organizationId: string, deliveryZoneId: string) {
  const list = await actor.call("get", zonesPath(organizationId));
  const create = await createZone(actor, organizationId, zoneBody());
  const get = await actor.call("get", zonesPath(organizationId, `/${deliveryZoneId}`));
  const update = await patchZone(actor, zonesPath(organizationId, `/${deliveryZoneId}`), {
    version: 1,
    name: { bn: "নাম", en: "Name" },
  });
  return [list, create, get, update];
}

describe("delivery-zone API", () => {
  it("creates, reads, lists, and updates a delivery zone", async () => {
    const world = await worldFor(harness, RETAIL);
    const areaCode = `Mirpur-${newId().slice(-8)}`;
    const body = zoneBody({ areaCodes: [areaCode], feeMinor: FEE_MINOR });
    const created = await createZone(world.alice, world.organizationA, body);
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(
      expect.objectContaining({
        zoneKey: body.zoneKey,
        name: ZONE_NAME,
        areaCodes: [areaCode.toLowerCase()],
        fee: { amount: FEE_MINOR, currency: "BDT" },
        status: DELIVERY_ZONE_STATUS.ACTIVE,
        version: 1,
      }),
    );
    expect(created.body.data.deliveryZoneId).toEqual(expect.any(String));
    expect(created.body.data.createdAt).toEqual(expect.any(String));

    const deliveryZoneId = created.body.data.deliveryZoneId as string;
    const read = await world.alice.call(
      "get",
      zonesPath(world.organizationA, `/${deliveryZoneId}`),
    );
    expect(read.status).toBe(200);
    expect(read.body.data.deliveryZoneId).toBe(deliveryZoneId);

    const listed = await world.alice.call("get", zonesPath(world.organizationA));
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ deliveryZoneId })]),
    );
    expect(listed.body.meta).toEqual({ page: 1, limit: 50, hasNext: false });

    const updated = await patchZone(
      world.alice,
      zonesPath(world.organizationA, `/${deliveryZoneId}`),
      {
        version: 1,
        feeMinor: 9_000,
        name: { bn: "ঢাকা দক্ষিণ", en: "Dhaka South" },
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);
    expect(updated.body.data.fee.amount).toBe(9_000);
    expect(updated.body.data.name.en).toBe("Dhaka South");
  });

  it("refuses overlapping ACTIVE areaCodes as a rule error and as an index conflict", async () => {
    const world = await worldFor(harness, RETAIL);
    const area = `overlap-${newId().slice(-8)}`;
    const first = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: [area] }),
    );
    expect(first.status).toBe(201);

    const duplicateInBody = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: [area, area.toUpperCase()] }),
    );
    expect(duplicateInBody.status).toBe(400);
    expect(duplicateInBody.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const second = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: [area] }),
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("lets a new ACTIVE zone claim an area after the previous zone is INACTIVE", async () => {
    const world = await worldFor(harness, RETAIL);
    const area = `reuse-${newId().slice(-8)}`;
    const first = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: [area] }),
    );
    expect(first.status).toBe(201);
    const inactivated = await patchZone(
      world.alice,
      zonesPath(world.organizationA, `/${first.body.data.deliveryZoneId}`),
      { version: 1, status: DELIVERY_ZONE_STATUS.INACTIVE },
    );
    expect(inactivated.status).toBe(200);
    expect(inactivated.body.data.status).toBe(DELIVERY_ZONE_STATUS.INACTIVE);

    const second = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: [area] }),
    );
    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe(DELIVERY_ZONE_STATUS.ACTIVE);
    expect(second.body.data.deliveryZoneId).not.toBe(first.body.data.deliveryZoneId);
  });

  it("refuses empty or duplicate areaCodes and a negative or non-integer fee", async () => {
    const world = await worldFor(harness, RETAIL);
    const empty = await createZone(world.alice, world.organizationA, zoneBody({ areaCodes: [] }));
    const duplicate = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ areaCodes: ["Gulshan", "gulshan"] }),
    );
    const negative = await createZone(world.alice, world.organizationA, zoneBody({ feeMinor: -1 }));
    const fractional = await createZone(
      world.alice,
      world.organizationA,
      zoneBody({ feeMinor: 1.5 }),
    );
    for (const refused of [empty, duplicate, negative, fractional]) {
      expect(refused.status).toBe(400);
      expect(refused.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    }
  });

  it("refuses every delivery-zone route without permission sales.deliveryZone.manage", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const staff = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.STAFF);
    const answers = await everyZoneRoute(
      staff,
      world.organizationA,
      created.body.data.deliveryZoneId as string,
    );
    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(answer.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
    }
  });

  it("refuses a member whose permission is held at one location only on every zone route", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const ownerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.OWNER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: ownerRoleId },
    ]);
    const answers = await everyZoneRoute(
      actor,
      world.organizationA,
      created.body.data.deliveryZoneId as string,
    );
    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(answer.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
    }
  });

  it("hides another organization's delivery zones with 404", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const foreignList = await world.bob.call("get", zonesPath(world.organizationA));
    const foreignGet = await world.bob.call(
      "get",
      zonesPath(world.organizationA, `/${created.body.data.deliveryZoneId}`),
    );
    const foreignCreate = await createZone(world.bob, world.organizationA, zoneBody());
    expect(foreignList.status).toBe(404);
    expect(foreignGet.status).toBe(404);
    expect(foreignCreate.status).toBe(404);

    const bZone = await createZone(world.bob, world.organizationB, zoneBody());
    expect(bZone.status).toBe(201);
    const crossId = await world.alice.call(
      "get",
      zonesPath(world.organizationA, `/${bZone.body.data.deliveryZoneId}`),
    );
    expect(crossId.status).toBe(404);
    expect(crossId.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("refuses a stale version with 409", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const stale = await patchZone(
      world.alice,
      zonesPath(world.organizationA, `/${created.body.data.deliveryZoneId}`),
      { version: 99, name: { bn: "পুরনো", en: "Stale" } },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe(ERROR_CODE.CONFLICT);
    expect(stale.body.error.details.currentVersion).toBe(1);
  });

  it("refuses a list limit above 100 and defaults to 50", async () => {
    const world = await worldFor(harness, RETAIL);
    const first = await createZone(world.alice, world.organizationA, zoneBody());
    const second = await createZone(world.alice, world.organizationA, zoneBody());
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const tooBig = await world.alice.call("get", `${zonesPath(world.organizationA)}?limit=101`);
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const page = await world.alice.call("get", `${zonesPath(world.organizationA)}?limit=1`);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toEqual({ page: 1, limit: 1, hasNext: true });

    const defaults = await world.alice.call("get", zonesPath(world.organizationA));
    expect(defaults.body.meta.limit).toBe(50);
  });

  it("the same Idempotency-Key returns the first create and writes nothing twice", async () => {
    const world = await worldFor(harness, RETAIL);
    const body = zoneBody();
    const key = newId();
    const first = await createZone(world.alice, world.organizationA, body, key);
    const replay = await createZone(world.alice, world.organizationA, body, key);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.data).toEqual(first.body.data);
    const listed = await world.alice.call("get", zonesPath(world.organizationA));
    expect(
      listed.body.data.filter((row: { zoneKey: string }) => row.zoneKey === body.zoneKey),
    ).toHaveLength(1);
  });

  it("the same Idempotency-Key returns the first update and writes nothing twice", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const path = zonesPath(world.organizationA, `/${created.body.data.deliveryZoneId}`);
    const key = newId();
    const body = { version: 1, feeMinor: 12_000 };
    const first = await patchZone(world.alice, path, body, key);
    const replay = await patchZone(world.alice, path, body, key);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual(first.body.data);
    expect(first.body.data.version).toBe(2);
    const read = await world.alice.call("get", path);
    expect(read.body.data.version).toBe(2);
    expect(read.body.data.fee.amount).toBe(12_000);
  });

  it("refuses a replay of the same Idempotency-Key with a changed body", async () => {
    const world = await worldFor(harness, RETAIL);
    const body = zoneBody();
    const key = newId();
    const first = await createZone(world.alice, world.organizationA, body, key);
    expect(first.status).toBe(201);
    const changed = await createZone(
      world.alice,
      world.organizationA,
      { ...body, feeMinor: FEE_MINOR + 1 },
      key,
    );
    expect(changed.status).toBe(422);
    expect(changed.body.error.code).toBe(ERROR_CODE.IDEMPOTENCY_MISMATCH);

    const path = zonesPath(world.organizationA, `/${first.body.data.deliveryZoneId}`);
    const updateKey = newId();
    const firstPatch = await patchZone(world.alice, path, { version: 1, feeMinor: 1 }, updateKey);
    expect(firstPatch.status).toBe(200);
    const changedPatch = await patchZone(world.alice, path, { version: 1, feeMinor: 2 }, updateKey);
    expect(changedPatch.status).toBe(422);
    expect(changedPatch.body.error.code).toBe(ERROR_CODE.IDEMPOTENCY_MISMATCH);
  });

  it("requires an Idempotency-Key for create and update", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createZone(world.alice, world.organizationA, zoneBody());
    expect(created.status).toBe(201);
    const missingCreate = await world.alice.callWith({
      method: "post",
      path: zonesPath(world.organizationA),
      body: zoneBody(),
      idempotencyKey: null,
    });
    expect(missingCreate.status).toBe(400);
    expect(missingCreate.body.error.details.fields).toEqual([
      { path: "Idempotency-Key", messageKey: "validation.idempotency_key_required" },
    ]);
    const missingUpdate = await patchZone(
      world.alice,
      zonesPath(world.organizationA, `/${created.body.data.deliveryZoneId}`),
      { version: 1, feeMinor: 1 },
      null,
    );
    expect(missingUpdate.status).toBe(400);
    expect(missingUpdate.body.error.details.fields).toEqual([
      { path: "Idempotency-Key", messageKey: "validation.idempotency_key_required" },
    ]);
  });

  it("unique index refuses a second concurrent ACTIVE zone claiming the same areaCode", async () => {
    const world = await worldFor(harness, RETAIL);
    const area = `race-${newId().slice(-8)}`;
    const results = await Promise.all([
      createZone(world.alice, world.organizationA, zoneBody({ areaCodes: [area] })),
      createZone(world.alice, world.organizationA, zoneBody({ areaCodes: [area] })),
    ]);
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);
    const refused = results.find((result) => result.status === 409);
    expect(refused?.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });
});
