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

describe("booking concurrency API", () => {
  it("allows exactly one of ten parallel creates for the last slot", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    const startsAt = "2026-11-01T04:00:00.000Z";
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Stylist cap1",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const contact = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
      contactType: "PERSON",
      name: "Customer",
      phoneE164: "+8801710000001",
      contactRoles: ["CUSTOMER"],
    });
    expect(contact.status).toBe(201);
    const contactId = (contact.body.data as { contactId: string }).contactId;

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        world.alice.callWith({
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
        }),
      ),
    );
    const created = attempts.filter((response) => response.status === 201);
    const conflicts = attempts.filter((response) => response.status === 409);
    const other = attempts.filter((response) => response.status !== 201 && response.status !== 409);
    expect(
      other.map((response) => ({ status: response.status, code: response.body.error?.code })),
    ).toEqual([]);
    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(9);
    expect(conflicts.every((response) => response.body.error?.code === "SLOT_UNAVAILABLE")).toBe(
      true,
    );
  });

  it("never exceeds capacity two for parallel creates on overlapping non-identical slots", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    const startsAt = "2026-11-01T06:00:00.000Z";
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA2,
      offeringId: offering.offeringId,
      name: "Room cap2",
      capacity: 2,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const contact = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
      contactType: "PERSON",
      name: "Guest",
      phoneE164: "+8801710000002",
      contactRoles: ["CUSTOMER"],
    });
    expect(contact.status).toBe(201);
    const contactId = (contact.body.data as { contactId: string }).contactId;

    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        world.alice.callWith({
          method: "post",
          path: `/orgs/${world.organizationA}/bookings`,
          idempotencyKey: newId(),
          body: {
            offeringId: offering.offeringId,
            variantId,
            locationId: world.locationA2,
            startsAt: new Date(new Date(startsAt).getTime() + index * 5 * 60_000).toISOString(),
            contactId,
          },
        }),
      ),
    );
    const capCreated = attempts.filter((response) => response.status === 201);
    const capConflicts = attempts.filter((response) => response.status === 409);
    const capOther = attempts.filter(
      (response) => response.status !== 201 && response.status !== 409,
    );
    expect(
      capOther.map((response) => ({ status: response.status, code: response.body.error?.code })),
    ).toEqual([]);
    expect(capCreated).toHaveLength(2);
    expect(capConflicts).toHaveLength(3);
  });

  it("returns 409 on reschedule into a taken slot and keeps the original slot", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    const firstStart = "2026-11-01T08:00:00.000Z";
    const secondStart = "2026-11-01T09:00:00.000Z";
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA2,
      offeringId: offering.offeringId,
      name: "Stylist reschedule",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const contact = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
      contactType: "PERSON",
      name: "Customer",
      phoneE164: "+8801710000003",
      contactRoles: ["CUSTOMER"],
    });
    expect(contact.status).toBe(201);
    const contactId = (contact.body.data as { contactId: string }).contactId;

    const first = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/bookings`,
      idempotencyKey: newId(),
      body: {
        offeringId: offering.offeringId,
        variantId,
        locationId: world.locationA2,
        startsAt: firstStart,
        contactId,
      },
    });
    expect(first.status).toBe(201);
    const firstBooking = first.body.data as {
      bookingId: string;
      version: number;
      startsAt: string;
    };

    const second = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/bookings`,
      idempotencyKey: newId(),
      body: {
        offeringId: offering.offeringId,
        variantId,
        locationId: world.locationA2,
        startsAt: secondStart,
        contactId,
      },
    });
    expect(second.status).toBe(201);

    const conflict = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${firstBooking.bookingId}/reschedule`,
      { version: firstBooking.version, startsAt: secondStart },
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("SLOT_UNAVAILABLE");

    const loaded = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${firstBooking.bookingId}`,
    );
    expect(loaded.status).toBe(200);
    expect(loaded.body.data.startsAt).toBe(firstBooking.startsAt);
  });
});
