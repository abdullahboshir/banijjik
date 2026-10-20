import { newId } from "@banijjik/ids";
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

async function createCustomerContact(world: Awaited<ReturnType<typeof worldFor>>) {
  const contact = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    contactType: "PERSON",
    name: "Customer",
    phoneE164: "+8801710000001",
    contactRoles: ["CUSTOMER"],
  });
  expect(contact.status).toBe(201);
  return (contact.body.data as { contactId: string }).contactId;
}

describe("booking transitions API", () => {
  it("checks in and completes a confirmed booking and refuses invalid transitions", async () => {
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
    const contactId = await createCustomerContact(world);
    const startsAt = "2026-11-01T04:00:00.000Z";

    const created = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/bookings`,
      idempotencyKey: newId(),
      body: {
        offeringId: offering.offeringId,
        variantId,
        locationId: world.locationA1,
        startsAt,
        contactId,
      },
    });
    expect(created.status).toBe(201);
    let booking = created.body.data as { bookingId: string; version: number; status: string };

    const checkedIn = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/check-in`,
      { version: booking.version },
    );
    expect(checkedIn.status).toBe(200);
    booking = checkedIn.body.data as typeof booking;
    expect(booking.status).toBe("CHECKED_IN");

    const completed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/complete`,
      { version: booking.version },
    );
    expect(completed.status).toBe(200);
    booking = completed.body.data as typeof booking;
    expect(booking.status).toBe("COMPLETED");

    const refused = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/check-in`,
      { version: booking.version },
    );
    expect(refused.status).toBe(409);
    expect(refused.body.error?.code).toBe("INVALID_TRANSITION");
  });

  it("releases capacity on cancel so the same slot can be booked again", async () => {
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
    const contactId = await createCustomerContact(world);
    const startsAt = "2026-11-01T04:00:00.000Z";

    const first = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/bookings`,
      idempotencyKey: newId(),
      body: {
        offeringId: offering.offeringId,
        variantId,
        locationId: world.locationA1,
        startsAt,
        contactId,
      },
    });
    expect(first.status).toBe(201);
    const booking = first.body.data as { bookingId: string; version: number };

    const cancelled = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/cancel`,
      { version: booking.version, reason: "Customer changed plans" },
    );
    expect(cancelled.status).toBe(200);

    const second = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/bookings`,
      idempotencyKey: newId(),
      body: {
        offeringId: offering.offeringId,
        variantId,
        locationId: world.locationA1,
        startsAt,
        contactId,
      },
    });
    expect(second.status).toBe(201);
  });
});
