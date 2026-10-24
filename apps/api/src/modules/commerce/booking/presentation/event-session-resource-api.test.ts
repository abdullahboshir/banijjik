import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createStylistResource,
  publishBookableEvent,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

const RETAIL = { industryTemplateKey: "RETAIL" };
const COACHING = { industryTemplateKey: "COACHING" };
const startsAt = "2026-11-01T04:00:00.000Z";
const endsAt = "2026-11-01T05:00:00.000Z";

async function fixture() {
  const world = await worldFor(harness, RETAIL, COACHING);
  const event = await publishBookableEvent(world.alice, world.organizationA);
  await createStylistResource(world.alice, world.organizationA, {
    locationId: world.locationA1,
    offeringId: rental.offeringId,
    name: "Hall",
    capacity: 1,
    weeklySchedule: SUNDAY_SCHEDULE,
    resourceTypeKey: "TABLE",
  });
  const resource = await harness.connections.tenantShared.collection("resources").findOne({
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  if (!resource) throw new Error("resource missing");
  return {
    world,
    event,
    rental: event,
    service: event,
    resourceId: String(resource.resourceId),
    path: `/orgs/${world.organizationA}/event-sessions`,
  };
}

function sessionBody(f: Awaited<ReturnType<typeof fixture>>, extra: Record<string, unknown> = {}) {
  return {
    offeringId: f.event.offeringId,
    variantId: f.event.variants[0]?.variantId,
    locationId: f.world.locationA1,
    startsAt,
    endsAt,
    capacity: 10,
    resourceIds: [f.resourceId],
    ...extra,
  };
}

async function createRental(f: Awaited<ReturnType<typeof fixture>>, from = startsAt) {
  const contact = await f.world.alice.call("post", `/orgs/${f.world.organizationA}/contacts`, {
    contactType: "PERSON",
    name: "Customer",
    phoneE164: "+8801710000002",
    contactRoles: ["CUSTOMER"],
  });
  expect(contact.status).toBe(201);
  return f.world.alice.call(
    "post",
    f.path,
    sessionBody(f, { startsAt: from, endsAt: "2026-11-01T05:00:00.000Z" }),
  );
}

describe("event sessions occupy resources", () => {
  it("a hall used by a session cannot be rented for overlapping hours", async () => {
    const f = await fixture();
    expect((await f.world.alice.call("post", f.path, sessionBody(f))).status).toBe(201);
    expect((await createRental(f)).status).toBe(409);
  });
  it("availability hides the slots a session occupies", async () => {
    const f = await fixture();
    expect((await f.world.alice.call("post", f.path, sessionBody(f))).status).toBe(201);
    const r = await f.world.alice.call(
      "get",
      `/orgs/${f.world.organizationA}/availability?offeringId=${f.service.offeringId}&variantId=${f.service.variants[0]?.variantId}&locationId=${f.world.locationA1}&date=2026-11-01`,
    );
    expect(r.status).toBe(200);
    const slots = r.body.data as { startsAt: string }[];
    expect(slots.some((s) => s.startsAt === startsAt)).toBe(false);
    expect(slots.some((s) => s.startsAt === "2026-11-01T03:00:00.000Z")).toBe(true);
  });
  it("a session cannot take a hall that is already rented", async () => {
    const f = await fixture();
    expect((await createRental(f)).status).toBe(201);
    const r = await f.world.alice.call("post", f.path, sessionBody(f));
    expect(r.status).toBe(409);
    expect(r.body.error.details.ruleKey).toBe("EVENT_SESSION_RESOURCE_BUSY");
  });
  it("two sessions cannot use the same hall at overlapping times", async () => {
    const f = await fixture();
    expect((await f.world.alice.call("post", f.path, sessionBody(f))).status).toBe(201);
    expect(
      (
        await f.world.alice.call(
          "post",
          f.path,
          sessionBody(f, {
            startsAt: "2026-11-01T04:30:00.000Z",
            endsAt: "2026-11-01T05:30:00.000Z",
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("a session cannot take a hall in time-off", async () => {
    const f = await fixture();
    const off = await f.world.alice.call(
      "post",
      `/orgs/${f.world.organizationA}/resources/${f.resourceId}/time-off`,
      { startsAt, endsAt, reason: "maintenance" },
    );
    expect(off.status).toBe(201);
    expect((await f.world.alice.call("post", f.path, sessionBody(f))).status).toBe(409);
  });
  it("cancelling a session frees the hall for rent", async () => {
    const f = await fixture();
    const created = await f.world.alice.call("post", f.path, sessionBody(f));
    const id = created.body.data.eventSessionId;
    expect(
      (await f.world.alice.call("post", `${f.path}/${id}/cancel`, { version: 1 })).status,
    ).toBe(200);
    expect((await createRental(f)).status).toBe(201);
  });
  it("moving a session frees the old window and takes the new one", async () => {
    const f = await fixture();
    const created = await f.world.alice.call("post", f.path, sessionBody(f));
    const id = created.body.data.eventSessionId;
    const moved = await f.world.alice.call("patch", `${f.path}/${id}`, {
      version: 1,
      startsAt: "2026-11-01T06:00:00.000Z",
      endsAt: "2026-11-01T07:00:00.000Z",
    });
    expect(moved.status).toBe(200);
    expect((await createRental(f)).status).toBe(201);
  });
  it("moving a session onto a busy window is refused and keeps the old hold", async () => {
    const f = await fixture();
    const first = await f.world.alice.call("post", f.path, sessionBody(f));
    const second = await f.world.alice.call(
      "post",
      f.path,
      sessionBody(f, { startsAt: "2026-11-01T06:00:00.000Z", endsAt: "2026-11-01T07:00:00.000Z" }),
    );
    const r = await f.world.alice.call("patch", `${f.path}/${second.body.data.eventSessionId}`, {
      version: 1,
      startsAt,
      endsAt,
    });
    expect(first.status).toBe(201);
    expect(r.status).toBe(409);
  });
  it("a stale version on a session move changes no counter", async () => {
    const f = await fixture();
    const c = await f.world.alice.call("post", f.path, sessionBody(f));
    const r = await f.world.alice.call("patch", `${f.path}/${c.body.data.eventSessionId}`, {
      version: 99,
      startsAt: "2026-11-01T06:00:00.000Z",
    });
    expect(r.status).toBe(409);
  });
  it("a capacity change touches no hall counter", async () => {
    const f = await fixture();
    const c = await f.world.alice.call("post", f.path, sessionBody(f));
    expect(
      (
        await f.world.alice.call("patch", `${f.path}/${c.body.data.eventSessionId}`, {
          version: 1,
          capacity: 12,
        })
      ).status,
    ).toBe(200);
    expect((await createRental(f)).status).toBe(409);
  });
  it("cancel releases the units taken even after the hall's capacity changed", async () => {
    const f = await fixture();
    const c = await f.world.alice.call("post", f.path, sessionBody(f));
    await f.world.alice.call("patch", `/orgs/${f.world.organizationA}/resources/${f.resourceId}`, {
      version: 1,
      capacity: 3,
    });
    expect(
      (
        await f.world.alice.call("post", `${f.path}/${c.body.data.eventSessionId}/cancel`, {
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect((await createRental(f)).status).toBe(201);
  });
  it("cancelling a session created before holds existed releases nothing", async () => {
    const f = await fixture();
    await harness.connections.tenantShared
      .collection("event_sessions")
      .insertOne({
        eventSessionId: "019a0000-0000-7000-8000-000000000001",
        organizationId: f.world.organizationA,
        locationId: f.world.locationA1,
        offeringId: f.event.offeringId,
        variantId: f.event.variants[0]?.variantId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        resourceIds: [f.resourceId],
        resourceHolds: [],
        capacity: 1,
        seatsSold: 0,
        status: "SCHEDULED",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    expect((await createRental(f)).status).toBe(201);
  });
  it("a session cannot use a resource of another organization", async () => {
    const f = await fixture();
    const other = await worldFor(harness, RETAIL, COACHING);
    const foreign = await publishBookableEvent(other.alice, other.organizationB);
    await createStylistResource(other.alice, other.organizationB, {
      locationId: other.locationB1,
      offeringId: foreign.offeringId,
      name: "Other",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });
    const row = await harness.connections.tenantShared
      .collection("resources")
      .findOne({ organizationId: other.organizationB });
    const r = await f.world.alice.call(
      "post",
      f.path,
      sessionBody(f, { resourceIds: [row?.resourceId] }),
    );
    expect(r.status).toBe(422);
  });
  it("a session cannot use a resource of another location", async () => {
    const f = await fixture();
    await createStylistResource(f.world.alice, f.world.organizationA, {
      locationId: f.world.locationA2,
      offeringId: f.event.offeringId,
      name: "Other",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });
    const row = await harness.connections.tenantShared
      .collection("resources")
      .findOne({ organizationId: f.world.organizationA, locationId: f.world.locationA2 });
    const r = await f.world.alice.call(
      "post",
      f.path,
      sessionBody(f, { resourceIds: [row?.resourceId] }),
    );
    expect(r.status).toBe(422);
  });
  it("a staff member without session permission cannot create a session on a hall", async () => {
    const f = await fixture();
    const actor = (await import("../../../../test-support/catalog-world.js")).memberWithRole;
    const staff = await actor(harness, f.world, "VIEWER");
    expect((await staff.call("post", f.path, sessionBody(f))).status).toBe(403);
  });
});
