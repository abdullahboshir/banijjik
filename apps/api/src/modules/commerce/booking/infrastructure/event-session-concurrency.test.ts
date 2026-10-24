import { asId, newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  BUCKETS_PER_HOUR,
  createRental,
  createSession,
  hallWorld,
  SESSION_STARTS_AT,
  usedByBucket,
} from "../../../../test-support/booking-hall-world.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { EventSession } from "../domain/event-session.entity.js";
import { MongoEventSessionRepository } from "./mongo-event-session.repository.js";

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
const RETAIL = { industryTemplateKey: "RETAIL" };
const RACE_ROUNDS = 5;
/** Two units: a session (all units) and a rental (one unit) cannot both fit, so exactly one wins. */
const HALL_CAPACITY = 2;

function expectedBuckets(used: number): Record<string, number> {
  const firstBucket = Date.parse(SESSION_STARTS_AT);
  return Object.fromEntries(
    Array.from({ length: BUCKETS_PER_HOUR }, (_unused, index) => [
      new Date(firstBucket + index * 5 * 60_000).toISOString(),
      used,
    ]),
  );
}
async function fixture() {
  const world = await worldFor(harness, RETAIL);
  const repository = new MongoEventSessionRepository();
  const session = EventSession.create({
    organizationId: asId(world.organizationA),
    locationId: asId(world.locationA1),
    offeringId: asId(newId()),
    variantId: newId(),
    resourceIds: [],
    capacity: 10,
    startsAt: new Date("2026-11-01T04:00:00Z"),
    endsAt: new Date("2026-11-01T05:00:00Z"),
    now: new Date("2026-10-23T00:00:00Z"),
    actorUserId: null,
  });
  await withOrganizationContext(world.organizationA, () => repository.insert(session));
  return { world, repository, session };
}
describe("event session atomic writes", () => {
  it.each(["capacity", "time"] as const)(
    "refuses a %s edit when seats sell after the read without a version bump",
    async (change) => {
      const { world, repository, session } = await fixture();
      await withOrganizationContext(world.organizationA, async () => {
        const previous = await repository.findById(session.toProps().eventSessionId);
        if (previous === undefined) throw new Error("session missing");
        const updated = previous.update({
          ...(change === "capacity"
            ? { capacity: 4 }
            : { startsAt: new Date("2026-11-01T04:30:00Z") }),
          now: new Date("2026-10-23T00:00:00Z"),
          actorUserId: null,
        });
        await harness.connections.tenantShared
          .collection("event_sessions")
          .updateOne(
            { eventSessionId: session.toProps().eventSessionId },
            { $inc: { seatsSold: 5 } },
          );
        await expect(repository.update(updated, 1, previous)).rejects.toMatchObject({
          code: "BUSINESS_RULE",
          details: {
            ruleKey:
              change === "capacity"
                ? "EVENT_SESSION_CAPACITY_BELOW_SOLD"
                : "EVENT_SESSION_TIME_LOCKED",
          },
        });
        const stored = await repository.findById(session.toProps().eventSessionId);
        expect(stored?.toProps()).toMatchObject({
          seatsSold: 5,
          capacity: 10,
          version: 1,
          startsAt: session.toProps().startsAt,
        });
      });
    },
  );
  it("refuses a seat release the counter cannot cover and leaves the row alone", async () => {
    const { world, repository, session } = await fixture();
    const eventSessionId = session.toProps().eventSessionId;
    await withOrganizationContext(world.organizationA, async () => {
      expect(await repository.reserveSeats({ eventSessionId, seats: 4 })).toBe(true);

      await expect(repository.releaseSeats({ eventSessionId, seats: 5 })).rejects.toThrow();

      const stored = await repository.findById(eventSessionId);
      expect(stored?.toProps()).toMatchObject({ seatsSold: 4, version: 1 });
    });
  });

  it("filters a list by caller locations even when the repository context permits all locations", async () => {
    const { world, repository } = await fixture();
    await withOrganizationContext(world.organizationA, async () => {
      const query = { page: 1, limit: 10 };
      expect((await repository.list(query, [world.locationA2])).items).toHaveLength(0);
      expect((await repository.list(query, [])).items).toHaveLength(0);
      expect(
        (await repository.list({ ...query, locationId: world.locationA1 }, [world.locationA2]))
          .items,
      ).toHaveLength(0);
      expect((await repository.list(query, [world.locationA1])).items).toHaveLength(1);
      expect((await repository.list(query, "ALL")).items).toHaveLength(1);
    });
  });

  it("a session and a rental racing for the same hall never both win", async () => {
    for (let round = 1; round <= RACE_ROUNDS; round += 1) {
      const hall = await hallWorld(harness, HALL_CAPACITY, HALL_TEMPLATES);

      const [session, rental] = await Promise.all([createSession(hall), createRental(hall)]);

      const winners = [session, rental].filter((response) => response.status === 201);
      expect(winners, `round ${round}`).toHaveLength(1);
      const loser = session.status === 201 ? rental : session;
      expect(loser.status).toBe(409);
      expect(loser.body.error.code).toBe("SLOT_UNAVAILABLE");
      // A session takes the whole hall; a rental takes one unit of it.
      const expectedUsed = session.status === 201 ? HALL_CAPACITY : 1;
      expect(await usedByBucket(harness, hall.resourceId)).toEqual(expectedBuckets(expectedUsed));
    }
  });

  it("two sessions racing for the same hall never both win", async () => {
    for (let round = 1; round <= RACE_ROUNDS; round += 1) {
      const hall = await hallWorld(harness, HALL_CAPACITY, HALL_TEMPLATES);

      const responses = await Promise.all([createSession(hall), createSession(hall)]);

      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      const loser = responses.find((response) => response.status !== 201);
      expect(loser?.status).toBe(409);
      expect(loser?.body.error.details.ruleKey).toBe("EVENT_SESSION_RESOURCE_BUSY");
      expect(await usedByBucket(harness, hall.resourceId)).toEqual(expectedBuckets(HALL_CAPACITY));
      const sessionRows = await harness.connections.tenantShared
        .collection("event_sessions")
        .countDocuments({ organizationId: hall.world.organizationA });
      expect(sessionRows).toBe(1);
    }
  });
});
