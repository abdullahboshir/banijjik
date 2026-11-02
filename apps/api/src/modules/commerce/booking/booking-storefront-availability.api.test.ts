import { ERROR_CODE } from "@banijjik/contracts";
import { WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY } from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";
import type { TwoOrganizations } from "../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
const SUNDAY_LOCAL = "2026-11-01";
const DHAKA_SUNDAY_HALF_PAST_MIDNIGHT = new Date("2026-10-31T18:30:00.000Z");

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function salonWorld(): Promise<TwoOrganizations> {
  return worldFor(harness, RETAIL, SALON);
}

async function publishServiceAt(
  world: TwoOrganizations,
  locationId: string,
): Promise<{ offeringId: string; variantId: string }> {
  const service = await publishBookableService(world.alice, world.organizationA);
  const variantId = service.variants[0]?.variantId;
  if (variantId === undefined) throw new Error("the published service has no variant");
  await createStylistResource(world.alice, world.organizationA, {
    locationId,
    offeringId: service.offeringId,
    name: "Stylist",
    capacity: 1,
    weeklySchedule: SUNDAY_SCHEDULE,
  });
  const available = await world.alice.call(
    "put",
    `/orgs/${world.organizationA}/offerings/${service.offeringId}/locations/${locationId}`,
    { isAvailable: true },
  );
  expect(available.status).toBe(200);
  return { offeringId: service.offeringId, variantId };
}

function availabilityCall(
  organizationId: string,
  query: Record<string, string>,
): ReturnType<typeof callStorefront> {
  return callStorefront(harness.app, {
    method: "get",
    organizationId,
    suffix: "/availability",
    query,
  });
}

describe("storefront public availability", () => {
  it("returns free slots for a published service at a public location grouped by local date", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const response = await availabilityCall(world.organizationA, {
      offeringId: published.offeringId,
      variantId: published.variantId,
      locationId: world.locationA1,
      startDate: SUNDAY_LOCAL,
      endDate: SUNDAY_LOCAL,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.offeringId).toBe(published.offeringId);
    expect(response.body.data.variantId).toBe(published.variantId);
    expect(response.body.data.locationId).toBe(world.locationA1);
    expect(response.body.data.days).toHaveLength(1);
    expect(response.body.data.days[0].date).toBe(SUNDAY_LOCAL);
    expect(response.body.data.days[0].slots.length).toBeGreaterThan(0);
    expect(response.body.data.days[0].slots[0].startsAt).toMatch(/T/);
    expect(response.body.data.days[0].slots[0].available).toBeUndefined();
  });

  it("refuses an availability range longer than 31 days", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const response = await availabilityCall(world.organizationA, {
      offeringId: published.offeringId,
      variantId: published.variantId,
      locationId: world.locationA1,
      startDate: "2026-11-01",
      endDate: "2026-12-02",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
  });

  it("refuses invalid startDate or endDate", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const response = await availabilityCall(world.organizationA, {
      offeringId: published.offeringId,
      variantId: published.variantId,
      locationId: world.locationA1,
      startDate: "not-a-date",
      endDate: "2026-11-05",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
  });

  it("answers 404 when the booking module is off", async () => {
    const world = await worldFor(harness, RETAIL);
    const response = await availabilityCall(world.organizationA, {
      offeringId: newId(),
      variantId: newId(),
      locationId: world.locationA1,
      startDate: SUNDAY_LOCAL,
      endDate: SUNDAY_LOCAL,
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("answers 404 for another organization's offeringId", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const response = await availabilityCall(world.organizationB, {
      offeringId: published.offeringId,
      variantId: published.variantId,
      locationId: world.locationB1,
      startDate: SUNDAY_LOCAL,
      endDate: SUNDAY_LOCAL,
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(response.body.error.messageKey).toBe("errors.storefront_not_available");
  });

  it("answers 400 CHECKOUT_LOCATION_MISMATCH when locationId is absent from a non-empty publicLocationIds list", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const patched = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY, value: [world.locationA1] }],
    });
    expect(patched.status).toBe(200);
    const response = await availabilityCall(world.organizationA, {
      offeringId: published.offeringId,
      variantId: published.variantId,
      locationId: world.locationA2,
      startDate: SUNDAY_LOCAL,
      endDate: SUNDAY_LOCAL,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.CHECKOUT_LOCATION_MISMATCH);
  });

  it("answers 404 for a draft or unpublished service", async () => {
    const world = await salonWorld();
    const created = await world.alice.call("post", `/orgs/${world.organizationA}/offerings`, {
      kind: "SERVICE",
      name: "Draft cut",
      kindDetails: {
        durationMinutes: 30,
        requiresResource: true,
        resourceTypeKeys: ["STYLIST"],
        bufferAfterMinutes: 0,
      },
      variants: [
        { name: "Default", price: { amount: 50000, currency: "BDT" }, unitKey: "SESSION" },
      ],
    });
    expect(created.status).toBe(201);
    const offering = created.body.data as {
      offeringId: string;
      variants: { variantId: string }[];
    };
    const variantId = offering.variants[0]?.variantId ?? newId();
    const response = await availabilityCall(world.organizationA, {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startDate: SUNDAY_LOCAL,
      endDate: SUNDAY_LOCAL,
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(response.body.error.messageKey).toBe("errors.storefront_not_available");
  });

  it("uses the organization local date between 00:00 and 06:00 Dhaka so a slot that is still Sunday locally is returned", async () => {
    const world = await salonWorld();
    const published = await publishServiceAt(world, world.locationA1);
    const previous = harness.clock.now();
    harness.clock.setNow(DHAKA_SUNDAY_HALF_PAST_MIDNIGHT);
    try {
      const response = await availabilityCall(world.organizationA, {
        offeringId: published.offeringId,
        variantId: published.variantId,
        locationId: world.locationA1,
        startDate: SUNDAY_LOCAL,
        endDate: SUNDAY_LOCAL,
      });
      expect(response.status).toBe(200);
      expect(response.body.data.days[0].date).toBe(SUNDAY_LOCAL);
      expect(response.body.data.days[0].slots.length).toBeGreaterThan(0);
      const firstStart = String(response.body.data.days[0].slots[0].startsAt);
      expect(firstStart.startsWith("2026-11-01T")).toBe(true);
    } finally {
      harness.clock.setNow(previous);
    }
  });
});
