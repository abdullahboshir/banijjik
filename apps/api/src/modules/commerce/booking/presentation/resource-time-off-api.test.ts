import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUNDAY_SCHEDULE } from "../../../../test-support/booking-api-world.js";
import {
  createSession,
  hallWorld,
  type HallWorld,
} from "../../../../test-support/booking-hall-world.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
/** Each seeded template sells one offering kind: COACHING events, RESTAURANT rentals, SALON services. */
const HALL_TEMPLATES = {
  created: { industryTemplateKey: "RETAIL" },
  event: { industryTemplateKey: "COACHING" },
  rental: { industryTemplateKey: "RESTAURANT" },
  service: { industryTemplateKey: "SALON" },
};
const STARTS_AT = "2026-11-01T04:00:00.000Z";
const ENDS_AT = "2026-11-01T06:00:00.000Z";
const OVERLAP_STARTS_AT = "2026-11-01T04:30:00.000Z";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function timeOffPath(organizationId: string, resourceId: string): string {
  return `/orgs/${organizationId}/resources/${resourceId}/time-off`;
}

function timeOffBody(startsAt = STARTS_AT, endsAt = ENDS_AT): { startsAt: string; endsAt: string } {
  return { startsAt, endsAt };
}

async function salonWorld(): Promise<TwoOrganizations> {
  return worldFor(harness, RETAIL, SALON);
}

async function createResource(world: TwoOrganizations): Promise<string> {
  const created = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
    locationId: world.locationA1,
    resourceTypeKey: "STYLIST",
    name: "Stylist one",
    weeklySchedule: SUNDAY_SCHEDULE,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return (created.body.data as { resourceId: string }).resourceId;
}

async function timeOffRowCount(resourceId: string): Promise<number> {
  return harness.connections.tenantShared.collection("resource_time_offs").countDocuments({
    resourceId,
  });
}

async function resourceUpdatedAudits(resourceId: string): Promise<Record<string, unknown>[]> {
  return harness.connections.tenantShared
    .collection("audit_logs")
    .find({ action: "booking.resource.updated", entityId: resourceId, entityType: "resource" })
    .toArray() as Promise<Record<string, unknown>[]>;
}

async function postTimeOff(
  world: TwoOrganizations,
  resourceId: string,
  body: { startsAt: string; endsAt: string } = timeOffBody(),
) {
  return world.alice.call("post", timeOffPath(world.organizationA, resourceId), body);
}

describe("resource time-off API", () => {
  it("the owner adds time-off to a resource and gets it back in the list", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);
    const path = timeOffPath(world.organizationA, resourceId);

    const created = await world.alice.call("post", path, timeOffBody());
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      resourceId,
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      reason: null,
    });
    expect(created.body.data.resourceTimeOffId).toEqual(expect.any(String));

    const list = await world.alice.call("get", path);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      resourceTimeOffId: created.body.data.resourceTimeOffId,
      resourceId,
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
    });
  });

  it("adding time-off writes one audit entry with the time window", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);

    const created = await postTimeOff(world, resourceId);
    expect(created.status).toBe(201);
    const rows = await resourceUpdatedAudits(resourceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["changes"]).toEqual({ timeOff: { to: `${STARTS_AT}/${ENDS_AT}` } });
  });

  it("time-off that ends before it starts is refused with 400", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);

    const refused = await postTimeOff(world, resourceId, {
      startsAt: ENDS_AT,
      endsAt: STARTS_AT,
    });
    expect(refused.status).toBe(400);
    expect(await timeOffRowCount(resourceId)).toBe(0);
  });

  it("a member without booking.resource.update gets 403", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);

    const refused = await cashier.call(
      "post",
      timeOffPath(world.organizationA, resourceId),
      timeOffBody(),
    );
    expect(refused.status).toBe(403);
    expect(await timeOffRowCount(resourceId)).toBe(0);
  });

  it("another organization cannot add time-off to the resource", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);

    const refused = await world.bob.call(
      "post",
      timeOffPath(world.organizationA, resourceId),
      timeOffBody(),
    );
    expect(refused.status).toBe(404);
    expect(await timeOffRowCount(resourceId)).toBe(0);
  });

  it("a member assigned only at another location cannot add time-off", async () => {
    const world = await salonWorld();
    const resourceId = await createResource(world);
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);

    const refused = await actor.call(
      "post",
      timeOffPath(world.organizationA, resourceId),
      timeOffBody(),
    );
    // LOCATION tenancy hides the resource at the other location, so the answer is 404 not 403.
    expect(refused.status).toBe(404);
    expect(await timeOffRowCount(resourceId)).toBe(0);
  });

  it("a booking cannot take a slot inside time-off added through the API", async () => {
    const hall: HallWorld = await hallWorld(harness, 1, HALL_TEMPLATES);
    const created = await hall.world.alice.call(
      "post",
      timeOffPath(hall.world.organizationA, hall.resourceId),
      { startsAt: OVERLAP_STARTS_AT, endsAt: ENDS_AT },
    );
    expect(created.status).toBe(201);

    const refused = await createSession(hall);
    expect(refused.status).toBe(409);
    expect(refused.body.error.details).toMatchObject({
      ruleKey: "EVENT_SESSION_RESOURCE_BUSY",
      resourceId: hall.resourceId,
    });
  });
});
