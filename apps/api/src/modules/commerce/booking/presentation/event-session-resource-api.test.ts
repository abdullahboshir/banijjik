import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BUCKETS_PER_HOUR,
  createHall,
  createRental,
  createSession,
  hallWorld,
  insertTimeOff,
  SESSION_ENDS_AT,
  SESSION_STARTS_AT,
  usedByBucket,
  usedValues,
  type HallWorld,
} from "../../../../test-support/booking-hall-world.js";
import { publishBookableService } from "../../../../test-support/booking-api-world.js";
import { memberWithRole, startCatalogApi } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();
/** Each seeded template sells one offering kind: COACHING events, RESTAURANT rentals, SALON services. */
const HALL_TEMPLATES = {
  created: { industryTemplateKey: "RETAIL" },
  event: { industryTemplateKey: "COACHING" },
  rental: { industryTemplateKey: "RESTAURANT" },
  service: { industryTemplateKey: "SALON" },
};
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

const LATER_STARTS_AT = "2026-11-01T06:00:00.000Z";
const LATER_ENDS_AT = "2026-11-01T07:00:00.000Z";

function sessionUrl(hall: HallWorld, eventSessionId: string): string {
  return `${hall.sessionsPath}/${eventSessionId}`;
}

function resourceUrl(hall: HallWorld): string {
  return `/orgs/${hall.world.organizationA}/resources/${hall.resourceId}`;
}

async function sessionRowCount(hall: HallWorld): Promise<number> {
  return harness.connections.tenantShared
    .collection("event_sessions")
    .countDocuments({ organizationId: hall.world.organizationA });
}

async function createdSessionId(hall: HallWorld, extra: Record<string, unknown> = {}) {
  const created = await createSession(hall, extra);
  expect(created.status).toBe(201);
  return created.body.data.eventSessionId as string;
}

describe("event sessions occupy resources", () => {
  it("a hall used by a session cannot be rented for overlapping hours", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await createdSessionId(hall);

    const rental = await createRental(hall, "2026-11-01T04:30:00.000Z");

    expect(rental.status).toBe(409);
    expect(rental.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("availability hides the slots a session occupies", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await createdSessionId(hall);

    const response = await hall.world.alice.call(
      "get",
      `/orgs/${hall.world.organizationA}/availability?offeringId=${hall.service.offeringId}&variantId=${hall.service.variants[0]?.variantId}&locationId=${hall.world.locationA1}&date=2026-11-01`,
    );

    expect(response.status).toBe(200);
    const starts = (response.body.data as { startsAt: string }[]).map((slot) => slot.startsAt);
    expect(starts).toContain("2026-11-01T03:30:00.000Z");
    expect(starts).toContain("2026-11-01T05:00:00.000Z");
    expect(starts).not.toContain("2026-11-01T04:00:00.000Z");
    expect(starts).not.toContain("2026-11-01T04:30:00.000Z");
  });

  it("a session cannot take a hall that is already rented", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    expect((await createRental(hall)).status).toBe(201);
    const before = await usedByBucket(harness, hall.resourceId);

    const refused = await createSession(hall);

    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("SLOT_UNAVAILABLE");
    expect(refused.body.error.details).toMatchObject({
      ruleKey: "EVENT_SESSION_RESOURCE_BUSY",
      resourceId: hall.resourceId,
    });
    expect(await sessionRowCount(hall)).toBe(0);
    expect(await usedByBucket(harness, hall.resourceId)).toEqual(before);
    expect(usedValues(before)).toEqual(Array(BUCKETS_PER_HOUR).fill(1));
  });

  it("two sessions cannot use the same hall at overlapping times", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await createdSessionId(hall);

    const overlapping = await createSession(hall, {
      startsAt: "2026-11-01T04:30:00.000Z",
      endsAt: "2026-11-01T05:30:00.000Z",
    });

    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.details.ruleKey).toBe("EVENT_SESSION_RESOURCE_BUSY");
    expect(await sessionRowCount(hall)).toBe(1);
    expect(usedValues(await usedByBucket(harness, hall.resourceId))).toEqual(
      Array(BUCKETS_PER_HOUR).fill(1),
    );
  });

  it("a session cannot take a hall in time-off", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await insertTimeOff(hall, {
      startsAt: "2026-11-01T04:30:00.000Z",
      endsAt: "2026-11-01T06:00:00.000Z",
    });

    const refused = await createSession(hall);

    expect(refused.status).toBe(409);
    expect(refused.body.error.details).toMatchObject({
      ruleKey: "EVENT_SESSION_RESOURCE_BUSY",
      resourceId: hall.resourceId,
    });
    expect(await sessionRowCount(hall)).toBe(0);
    expect(await usedByBucket(harness, hall.resourceId)).toEqual({});
  });

  it("cancelling a session frees the hall for rent", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const eventSessionId = await createdSessionId(hall);
    expect(usedValues(await usedByBucket(harness, hall.resourceId))).toEqual(
      Array(BUCKETS_PER_HOUR).fill(1),
    );

    const cancelled = await hall.world.alice.call(
      "post",
      `${sessionUrl(hall, eventSessionId)}/cancel`,
      { version: 1 },
    );

    expect(cancelled.status).toBe(200);
    expect(usedValues(await usedByBucket(harness, hall.resourceId))).toEqual(
      Array(BUCKETS_PER_HOUR).fill(0),
    );
    expect((await createRental(hall)).status).toBe(201);
  });

  it("moving a session frees the old window and takes the new one", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const eventSessionId = await createdSessionId(hall);

    const moved = await hall.world.alice.call("patch", sessionUrl(hall, eventSessionId), {
      version: 1,
      startsAt: LATER_STARTS_AT,
      endsAt: LATER_ENDS_AT,
    });

    expect(moved.status).toBe(200);
    expect(moved.body.data.version).toBe(2);
    const buckets = await usedByBucket(harness, hall.resourceId);
    const oldWindow = Object.entries(buckets).filter(([start]) => start < LATER_STARTS_AT);
    const newWindow = Object.entries(buckets).filter(([start]) => start >= LATER_STARTS_AT);
    expect(oldWindow).toHaveLength(BUCKETS_PER_HOUR);
    expect(oldWindow.every(([, used]) => used === 0)).toBe(true);
    expect(newWindow).toHaveLength(BUCKETS_PER_HOUR);
    expect(newWindow.every(([, used]) => used === 1)).toBe(true);
    expect((await createRental(hall)).status).toBe(201);
    expect((await createRental(hall, LATER_STARTS_AT)).status).toBe(409);
  });

  it("moving a session onto a busy window is refused and keeps the old hold", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await createdSessionId(hall);
    const movingId = await createdSessionId(hall, {
      startsAt: LATER_STARTS_AT,
      endsAt: LATER_ENDS_AT,
    });
    const before = await usedByBucket(harness, hall.resourceId);

    const refused = await hall.world.alice.call("patch", sessionUrl(hall, movingId), {
      version: 1,
      startsAt: "2026-11-01T04:30:00.000Z",
      endsAt: "2026-11-01T05:30:00.000Z",
    });

    expect(refused.status).toBe(409);
    expect(refused.body.error.details.ruleKey).toBe("EVENT_SESSION_RESOURCE_BUSY");
    expect(await usedByBucket(harness, hall.resourceId)).toEqual(before);
    const stored = await hall.world.alice.call("get", sessionUrl(hall, movingId));
    expect(stored.body.data).toMatchObject({
      version: 1,
      startsAt: LATER_STARTS_AT,
      endsAt: LATER_ENDS_AT,
    });
  });

  it("a stale version on a session move changes no counter", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const eventSessionId = await createdSessionId(hall);
    const before = await usedByBucket(harness, hall.resourceId);

    const stale = await hall.world.alice.call("patch", sessionUrl(hall, eventSessionId), {
      version: 99,
      startsAt: LATER_STARTS_AT,
      endsAt: LATER_ENDS_AT,
    });

    expect(stale.status).toBe(409);
    expect(await usedByBucket(harness, hall.resourceId)).toEqual(before);
    const stored = await hall.world.alice.call("get", sessionUrl(hall, eventSessionId));
    expect(stored.body.data).toMatchObject({ version: 1, startsAt: SESSION_STARTS_AT });
  });

  it("a capacity change touches no hall counter", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const eventSessionId = await createdSessionId(hall);
    const before = await usedByBucket(harness, hall.resourceId);

    const changed = await hall.world.alice.call("patch", sessionUrl(hall, eventSessionId), {
      version: 1,
      capacity: 12,
    });

    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ capacity: 12, version: 2 });
    expect(await usedByBucket(harness, hall.resourceId)).toEqual(before);
  });

  it("cancel releases the units taken even after the hall's capacity changed", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const eventSessionId = await createdSessionId(hall);
    const resized = await hall.world.alice.call("patch", resourceUrl(hall), {
      version: 1,
      capacity: 3,
    });
    expect(resized.status).toBe(200);

    const cancelled = await hall.world.alice.call(
      "post",
      `${sessionUrl(hall, eventSessionId)}/cancel`,
      { version: 1 },
    );

    expect(cancelled.status).toBe(200);
    expect(usedValues(await usedByBucket(harness, hall.resourceId))).toEqual(
      Array(BUCKETS_PER_HOUR).fill(0),
    );
    for (let rental = 1; rental <= 3; rental += 1) {
      expect((await createRental(hall)).status).toBe(201);
    }
    expect((await createRental(hall)).status).toBe(409);
  });

  it("cancelling a session created before holds existed releases nothing", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    expect((await createRental(hall)).status).toBe(201);
    const eventSessionId = newId();
    const now = new Date();
    await harness.connections.tenantShared.collection("event_sessions").insertOne({
      eventSessionId,
      organizationId: hall.world.organizationA,
      locationId: hall.world.locationA1,
      offeringId: hall.event.offeringId,
      variantId: hall.event.variants[0]?.variantId,
      startsAt: new Date(SESSION_STARTS_AT),
      endsAt: new Date(SESSION_ENDS_AT),
      resourceIds: [hall.resourceId],
      capacity: 10,
      seatsSold: 0,
      status: "SCHEDULED",
      bookingsSettledAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });

    const cancelled = await hall.world.alice.call(
      "post",
      `${sessionUrl(hall, eventSessionId)}/cancel`,
      { version: 1 },
    );

    expect(cancelled.status).toBe(200);
    expect(usedValues(await usedByBucket(harness, hall.resourceId))).toEqual(
      Array(BUCKETS_PER_HOUR).fill(1),
    );
  });

  it("a session cannot use a resource of another organization", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: hall.world.organizationB },
        { $set: { industryTemplateKey: "SALON" }, $inc: { configVersion: 1 } },
      );
    const foreignOffering = await publishBookableService(hall.world.bob, hall.world.organizationB);
    const foreignResourceId = await createHall(harness, hall.world.bob, {
      organizationId: hall.world.organizationB,
      locationId: hall.world.locationB1,
      offeringIds: [foreignOffering.offeringId],
      capacity: 1,
    });

    const refused = await createSession(hall, { resourceIds: [foreignResourceId] });

    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("RESOURCE_WRONG_LOCATION");
    expect(await usedByBucket(harness, foreignResourceId)).toEqual({});
    expect(await sessionRowCount(hall)).toBe(0);
  });

  it("a session cannot use a resource of another location", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const otherLocationResourceId = await createHall(harness, hall.world.alice, {
      organizationId: hall.world.organizationA,
      locationId: hall.world.locationA2,
      offeringIds: [hall.rental.offeringId],
      capacity: 1,
      name: "Other location hall",
    });

    const refused = await createSession(hall, { resourceIds: [otherLocationResourceId] });

    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("RESOURCE_WRONG_LOCATION");
    expect(await usedByBucket(harness, otherLocationResourceId)).toEqual({});
    expect(await sessionRowCount(hall)).toBe(0);
  });

  it("a staff member without session permission cannot create a session on a hall", async () => {
    const hall = await hallWorld(harness, 1, HALL_TEMPLATES);
    const viewer = await memberWithRole(harness, hall.world, SYSTEM_ROLE_KEY.VIEWER);

    const refused = await viewer.call("post", hall.sessionsPath, {
      offeringId: hall.event.offeringId,
      variantId: hall.event.variants[0]?.variantId,
      locationId: hall.world.locationA1,
      startsAt: SESSION_STARTS_AT,
      endsAt: SESSION_ENDS_AT,
      capacity: 10,
      resourceIds: [hall.resourceId],
    });

    expect(refused.status).toBe(403);
    expect(await usedByBucket(harness, hall.resourceId)).toEqual({});
    expect(await sessionRowCount(hall)).toBe(0);
  });
});
