import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("booking availability API", () => {
  it("returns a free slot inside schedule and excludes past the closing edge", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Stylist 1",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const businessDate = "2026-11-01";
    const response = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/availability?offeringId=${offering.offeringId}&variantId=${variantId}&locationId=${world.locationA1}&date=${businessDate}`,
    );
    expect(response.status).toBe(200);
    const slots = response.body.data as {
      startsAt: string;
      endsAt: string;
      resourceIds: string[];
    }[];
    expect(slots.length).toBeGreaterThan(0);

    const lastSlot = slots[slots.length - 1];
    if (lastSlot === undefined) throw new Error("missing last slot");
    expect(new Date(lastSlot.startsAt).toISOString()).toBe("2026-11-01T11:30:00.000Z");
    expect(new Date(lastSlot.endsAt).toISOString()).toBe("2026-11-01T12:00:00.000Z");

    const firstSlot = slots.find((slot) => slot.startsAt === "2026-11-01T04:00:00.000Z");
    expect(firstSlot).toBeDefined();
    expect(firstSlot?.resourceIds.length).toBe(1);
  });
});
