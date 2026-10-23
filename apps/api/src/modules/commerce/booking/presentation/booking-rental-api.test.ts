import { newId } from "@banijjik/ids";
import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createStylistResource,
  publishBookableRental,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const RESTAURANT = { industryTemplateKey: "RESTAURANT" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function createCustomerContact(
  actor: import("../../../../test-support/two-organizations.js").ApiActor,
  organizationId: string,
): Promise<string> {
  const contact = await actor.call("post", `/orgs/${organizationId}/contacts`, {
    contactType: "PERSON",
    name: "Rental Customer",
    phoneE164: "+8801710000002",
    contactRoles: ["CUSTOMER"],
  });
  expect(contact.status).toBe(201);
  return (contact.body.data as { contactId: string }).contactId;
}

describe("booking rental API", () => {
  it("books HOUR, DAY and NIGHT rentals with correct end times", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    // 1. HOUR rental
    const hourlyOffering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Hourly Room",
      rateUnit: "HOUR",
      minUnits: 1,
      maxUnits: 12,
      unitPriceAmount: 15000,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: hourlyOffering.offeringId,
      name: "Room 1",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });

    const hourRes = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: hourlyOffering.offeringId,
      variantId: hourlyOffering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 3,
      contactId,
    });
    expect(hourRes.status).toBe(201);
    const hourBooking = hourRes.body.data as {
      startsAt: string;
      endsAt: string;
      kind: string;
      quantity: number;
      price: { total: { amount: number } };
    };
    expect(hourBooking.kind).toBe("RENTAL");
    expect(hourBooking.quantity).toBe(3);
    expect(hourBooking.startsAt).toBe("2026-11-01T04:00:00.000Z");
    expect(hourBooking.endsAt).toBe("2026-11-01T07:00:00.000Z");
    // 3 * 15000 = 45000 minor units
    expect(hourBooking.price.total.amount).toBe(45000);

    // 2. DAY rental
    const dailyOffering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Daily Hall",
      rateUnit: "DAY",
      minUnits: 1,
      maxUnits: 30,
      unitPriceAmount: 50000,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: dailyOffering.offeringId,
      name: "Hall 1",
      capacity: 1,
      weeklySchedule: [],
      resourceTypeKey: "TABLE",
    });

    const dayRes = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: dailyOffering.offeringId,
      variantId: dailyOffering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 2,
      contactId,
    });
    expect(dayRes.status).toBe(201);
    const dayBooking = dayRes.body.data as {
      startsAt: string;
      endsAt: string;
      kind: string;
      quantity: number;
    };
    expect(dayBooking.kind).toBe("RENTAL");
    expect(dayBooking.quantity).toBe(2);
    expect(dayBooking.startsAt).toBe("2026-11-01T04:00:00.000Z");
    expect(dayBooking.endsAt).toBe("2026-11-03T04:00:00.000Z");

    // 3. NIGHT rental with checkInTime and checkOutTime
    const nightOffering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Night Cabin",
      rateUnit: "NIGHT",
      minUnits: 1,
      maxUnits: 14,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      unitPriceAmount: 80000,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: nightOffering.offeringId,
      name: "Cabin 1",
      capacity: 1,
      weeklySchedule: [],
      resourceTypeKey: "TABLE",
    });

    // Request start time on 2026-11-01
    const nightRes = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: nightOffering.offeringId,
      variantId: nightOffering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T09:00:00.000Z",
      quantity: 2,
      contactId,
    });
    expect(nightRes.status).toBe(201);
    const nightBooking = nightRes.body.data as {
      startsAt: string;
      endsAt: string;
      kind: string;
      quantity: number;
    };
    expect(nightBooking.kind).toBe("RENTAL");
    expect(nightBooking.quantity).toBe(2);
    // In Dhaka timezone (+06:00):
    // Check-in on Nov 1 at 14:00 Dhaka = 08:00 UTC
    expect(nightBooking.startsAt).toBe("2026-11-01T08:00:00.000Z");
    // Check-out on Nov 3 at 11:00 Dhaka = 05:00 UTC
    expect(nightBooking.endsAt).toBe("2026-11-03T05:00:00.000Z");
  });

  it("enforces units below min or above max -> 422 BOOKING_RENTAL_UNITS_OUT_OF_RANGE", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    const offering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Conference Room",
      rateUnit: "HOUR",
      minUnits: 2,
      maxUnits: 6,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Room A",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });

    // 1. Below minUnits (quantity 1 < 2)
    const belowMin = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 1,
      contactId,
    });
    expect(belowMin.status).toBe(422);
    expect(belowMin.body.error?.details?.ruleKey).toBe("BOOKING_RENTAL_UNITS_OUT_OF_RANGE");

    // 2. Above maxUnits (quantity 7 > 6)
    const aboveMax = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 7,
      contactId,
    });
    expect(aboveMax.status).toBe(422);
    expect(aboveMax.body.error?.details?.ruleKey).toBe("BOOKING_RENTAL_UNITS_OUT_OF_RANGE");
  });

  it("enforces 31-day cap: over 31 days -> 422; 31-day rental succeeds in transaction", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    const offering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Monthly Suite",
      rateUnit: "DAY",
      minUnits: 1,
      maxUnits: 40, // Offering claims up to 40, but system caps at 31
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Suite 101",
      capacity: 1,
      weeklySchedule: [],
      resourceTypeKey: "TABLE",
    });

    // 1. 32 days -> 422
    const over31 = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 32,
      contactId,
    });
    expect(over31.status).toBe(422);
    expect(over31.body.error?.details?.ruleKey).toBe("BOOKING_RENTAL_DURATION_EXCEEDED");

    // 2. 31 days -> succeeds and writes all buckets in transaction
    const exactly31 = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 31,
      contactId,
    });
    expect(exactly31.status).toBe(201);
    const booking = exactly31.body.data as { quantity: number; status: string };
    expect(booking.quantity).toBe(31);
    expect(booking.status).toBe("CONFIRMED");
  });

  it("two parallel bookings for the last unit -> one wins (201), the other 409", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    const offering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Single Unit Equipment",
      rateUnit: "HOUR",
      minUnits: 1,
      maxUnits: 10,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Exclusive Projector",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });

    const startsAt = "2026-11-01T04:00:00.000Z";
    const variantId = offering.variants[0]?.variantId;

    const [first, second] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/bookings`,
        idempotencyKey: newId(),
        body: {
          offeringId: offering.offeringId,
          variantId,
          locationId: world.locationA1,
          startsAt,
          quantity: 2,
          contactId,
        },
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/bookings`,
        idempotencyKey: newId(),
        body: {
          offeringId: offering.offeringId,
          variantId,
          locationId: world.locationA1,
          startsAt,
          quantity: 2,
          contactId,
        },
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const conflictRes = first.status === 409 ? first : second;
    expect(conflictRes.body.error?.code).toBe("SLOT_UNAVAILABLE");
  });

  it("computes depositAmount from rental kind details and prevents confirmation before deposit is paid", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    const depositRental = await publishBookableRental(world.alice, world.organizationA, {
      name: "Luxury Villa",
      rateUnit: "DAY",
      minUnits: 1,
      depositAmount: { amount: 50000, currency: "BDT" },
      unitPriceAmount: 200000,
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: depositRental.offeringId,
      name: "Villa 1",
      capacity: 1,
      weeklySchedule: [],
      resourceTypeKey: "TABLE",
    });

    // Create staff booking for rental with depositAmount -> creates in REQUESTED status
    const created = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: depositRental.offeringId,
      variantId: depositRental.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 2,
      contactId,
    });
    expect(created.status).toBe(201);
    const data = created.body.data as {
      bookingId: string;
      status: string;
      depositRequired: { amount: number };
      version: number;
    };
    expect(data.status).toBe("REQUESTED");
    expect(data.depositRequired.amount).toBe(50000);

    // Confirming before deposit is satisfied fails with 422 DEPOSIT_REQUIRED
    const confirmAttempt = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${data.bookingId}/confirm`,
      { version: data.version },
    );
    expect(confirmAttempt.status).toBe(422);
    expect(confirmAttempt.body.error?.details?.ruleKey).toBe("errors.deposit_required");
  });

  it("enforces permission denied, cross-org, and cross-location checks for rental bookings", async () => {
    const world = await worldFor(harness, RETAIL, RESTAURANT);
    const contactId = await createCustomerContact(world.alice, world.organizationA);

    const offering = await publishBookableRental(world.alice, world.organizationA, {
      name: "Studio Room",
      rateUnit: "HOUR",
    });
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Studio 1",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      resourceTypeKey: "TABLE",
    });

    const payload = {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 1,
      contactId,
    };

    // 1. Permission denied for VIEWER
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const viewerDenied = await viewer.call(
      "post",
      `/orgs/${world.organizationA}/bookings`,
      payload,
    );
    expect(viewerDenied.status).toBe(403);
    expect(viewerDenied.body.error?.code).toBe("FORBIDDEN");

    // 2. Cross-org: bob (org B) calling org A -> 404 (ADR-080, existence not revealed)
    const crossOrg = await world.bob.call("post", `/orgs/${world.organizationA}/bookings`, payload);
    expect(crossOrg.status).toBe(404);

    // 3. Cross-location: Sam (assigned to locationA1 only) calling org A with locationA2
    const crossLoc = await world.sam.call("post", `/orgs/${world.organizationA}/bookings`, {
      ...payload,
      locationId: world.locationA2,
    });
    expect(crossLoc.status).toBe(403);
    expect(crossLoc.body.error?.code).toBe("LOCATION_FORBIDDEN");
  });
});
