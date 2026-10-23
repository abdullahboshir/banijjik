import { asId, newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { EventSession } from "../domain/event-session.entity.js";
import { MongoEventSessionRepository } from "./mongo-event-session.repository.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});
const RETAIL = { industryTemplateKey: "RETAIL" };
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
  it("filters a list by caller locations even when the repository context permits all locations", async () => {
    const { world, repository } = await fixture();
    await withOrganizationContext(world.organizationA, async () => {
      const query = { page: 1, limit: 10 };
      expect((await repository.list(query, [world.locationA2])).items).toHaveLength(0);
      expect((await repository.list(query, [])).items).toHaveLength(0);
      expect((await repository.list(query, [world.locationA1])).items).toHaveLength(1);
      expect((await repository.list(query, "ALL")).items).toHaveLength(1);
    });
  });
});
