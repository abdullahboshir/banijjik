import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishBookableService } from "../../../../test-support/booking-api-world.js";
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

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});
const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
async function setup() {
  const world = await worldFor(harness, RETAIL, SALON);
  await harness.connections.platform
    .collection("organizations")
    .updateOne(
      { organizationId: world.organizationB },
      { $set: SALON, $inc: { configVersion: 1 } },
    );
  const offering = await publishBookableService(world.alice, world.organizationA);
  await harness.connections.tenantShared
    .collection("offerings")
    .updateOne({ offeringId: offering.offeringId }, { $set: { kind: "EVENT" } });
  return {
    world,
    offering,
    path: `/orgs/${world.organizationA}/event-sessions`,
    body: {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      endsAt: "2026-11-01T05:00:00.000Z",
      capacity: 10,
      resourceIds: [],
    },
  };
}
describe("event session API", () => {
  it("creates, reads, lists, edits and cancels a versioned session", async () => {
    const { world, path, body } = await setup();
    const created = await world.alice.call("post", path, body);
    expect(created.status).toBe(201);
    const session = created.body.data;
    expect(session).toMatchObject({ status: "SCHEDULED", seatsSold: 0, version: 1 });
    expect(session._id).toBeUndefined();
    const single = `${path}/${session.eventSessionId}`;
    expect((await world.alice.call("get", single)).status).toBe(200);
    const list = await world.alice.call("get", `${path}?limit=1&locationId=${world.locationA1}`);
    expect(list.body.data).toHaveLength(1);
    expect((await world.alice.call("patch", single, { version: 1, capacity: 12 })).status).toBe(
      200,
    );
    expect((await world.alice.call("patch", single, { version: 1, capacity: 13 })).status).toBe(
      409,
    );
    const moved = await world.alice.call("patch", single, {
      version: 2,
      startsAt: "2026-11-01T03:30:00.000Z",
    });
    expect(moved.status).toBe(200);
    const cancelled = await world.alice.call("post", `${single}/cancel`, { version: 3 });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect((await world.alice.call("patch", single, { version: 4, capacity: 20 })).status).toBe(
      409,
    );
  });
  it("refuses capacity below sold seats and time changes after seats are sold", async () => {
    const { world, path, body } = await setup();
    const created = await world.alice.call("post", path, body);
    const single = `${path}/${created.body.data.eventSessionId}`;
    await harness.connections.tenantShared
      .collection("event_sessions")
      .updateOne({ eventSessionId: created.body.data.eventSessionId }, { $set: { seatsSold: 5 } });
    expect((await world.alice.call("patch", single, { version: 1, capacity: 4 })).status).toBe(422);
    expect(
      (
        await world.alice.call("patch", single, {
          version: 1,
          startsAt: "2026-11-01T04:30:00.000Z",
        })
      ).status,
    ).toBe(422);
    expect((await world.alice.call("patch", single, { version: 1, capacity: 15 })).status).toBe(
      200,
    );
  });
  it.each([
    { mode: "SERVICE", behavior: "refuses a SERVICE offering" },
    { mode: "ARCHIVED", behavior: "refuses an archived EVENT offering" },
    { mode: "LOCATION_OFF", behavior: "refuses an EVENT offering turned off at the location" },
    { mode: "VARIANT_OFF", behavior: "refuses an EVENT variant turned off at the location" },
  ])("$behavior", async ({ mode }) => {
    const { world, offering, path, body } = await setup();
    if (mode === "LOCATION_OFF" || mode === "VARIANT_OFF") {
      await harness.connections.tenantShared.collection("offering_locations").insertOne({
        offeringLocationId: newId(),
        organizationId: world.organizationA,
        locationId: world.locationA1,
        offeringId: offering.offeringId,
        ...(mode === "VARIANT_OFF" ? { variantId: body.variantId } : {}),
        isAvailable: false,
      });
    } else {
      await harness.connections.tenantShared
        .collection("offerings")
        .updateOne(
          { offeringId: offering.offeringId },
          { $set: mode === "SERVICE" ? { kind: "SERVICE" } : { status: "ARCHIVED" } },
        );
    }
    const response = await world.alice.call("post", path, body);
    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("OFFERING_NOT_BOOKABLE");
  });
  it("rejects invalid dates and organization IDs in input", async () => {
    const { world, path, body } = await setup();
    expect((await world.alice.call("post", path, { ...body, endsAt: body.startsAt })).status).toBe(
      400,
    );
    expect(
      (await world.alice.call("post", path, { ...body, organizationId: world.organizationA }))
        .status,
    ).toBe(400);
  });
  it("grants staff and viewers read only and denies session writes", async () => {
    const { world, path, body } = await setup();
    for (const role of [SYSTEM_ROLE_KEY.STAFF, SYSTEM_ROLE_KEY.VIEWER]) {
      const actor = await memberWithRole(harness, world, role);
      expect((await actor.call("get", path)).status).toBe(200);
      expect((await actor.call("post", path, body)).status).toBe(403);
    }
  });
  it("denies cross-organization and cross-location access", async () => {
    const { world, path, body } = await setup();
    const created = await world.alice.call("post", path, body);
    const single = `${path}/${created.body.data.eventSessionId}`;
    expect((await world.bob.call("get", single)).status).toBe(404);
    expect(
      (
        await world.bob.call(
          "get",
          `/orgs/${world.organizationB}/event-sessions/${created.body.data.eventSessionId}`,
        )
      ).status,
    ).toBe(404);
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);
    expect((await actor.call("post", path, body)).status).toBe(403);
    expect((await actor.call("get", single)).status).toBeGreaterThanOrEqual(400);
    expect(
      (await actor.call("patch", single, { version: 1, capacity: 20 })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await actor.call("post", `${single}/cancel`, { version: 1 })).status,
    ).toBeGreaterThanOrEqual(400);
    expect((await actor.call("get", `${path}?locationId=${world.locationA1}`)).status).toBe(403);
    const list = await actor.call("get", path);
    expect(list.body.data).toHaveLength(0);
  });
});
