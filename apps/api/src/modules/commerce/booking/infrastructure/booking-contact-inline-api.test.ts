import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";

import { MongoBookingRepository } from "./mongo-booking.repositories.js";

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

interface BookingResponseShape {
  bookingId: string;
  contactId: string;
}

interface ContactResponseShape {
  contactId: string;
  contactType: string;
  name: string | null;
  phoneE164: string | null;
  contactRoles: string[];
  source: string;
  status: string;
}

async function bookInlineContact(
  world: Awaited<ReturnType<typeof worldFor>>,
  body: Record<string, unknown>,
): Promise<{ status: number; data: BookingResponseShape; error?: { code: string } }> {
  const response = await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/bookings`,
    idempotencyKey: newId(),
    body,
  });
  return {
    status: response.status,
    data: response.body.data as BookingResponseShape,
    ...(response.body.error === undefined ? {} : { error: response.body.error }),
  };
}

describe("booking inline contact API", () => {
  it("rejects missing and archived contacts", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Active contact resource",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });
    const body = {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contactId: newId(),
    };
    expect((await bookInlineContact(world, body)).status).toBe(404);
    const contact = await world.alice.call("post", "/orgs/" + world.organizationA + "/contacts", {
      contactType: "PERSON",
      name: "Archived guest",
      phoneE164: "+8801710000405",
      contactRoles: ["CUSTOMER"],
    });
    expect(contact.status).toBe(201);
    const view = contact.body.data as { contactId: string; version: number };
    const archived = await world.alice.call(
      "post",
      "/orgs/" + world.organizationA + "/contacts/" + view.contactId + "/archive",
      { version: view.version },
    );
    expect(archived.status).toBe(200);
    expect((await bookInlineContact(world, { ...body, contactId: view.contactId })).status).toBe(
      404,
    );
  });
  it("rejects a contact from another organization and a write outside assigned locations", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Isolation resource",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });
    const foreign = await world.bob.call("post", "/orgs/" + world.organizationB + "/contacts", {
      contactType: "PERSON",
      name: "Foreign guest",
      phoneE164: "+8801710000404",
      contactRoles: ["CUSTOMER"],
    });
    expect(foreign.status).toBe(201);
    const body = {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contactId: (foreign.body.data as { contactId: string }).contactId,
    };
    expect((await bookInlineContact(world, body)).status).toBe(404);
    const wrongLocation = await world.sam.callWith({
      method: "post",
      path: "/orgs/" + world.organizationA + "/bookings",
      idempotencyKey: newId(),
      body: { ...body, locationId: world.locationA2 },
    });
    expect(wrongLocation.status).toBe(403);
    const crossOrg = await world.bob.call(
      "get",
      "/orgs/" + world.organizationA + "/bookings?limit=100",
    );
    expect(crossOrg.status).toBe(404);
  });
  it("rolls back inline contact and capacity when inserting the booking fails", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");
    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Rollback resource",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });
    const body = {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contact: { create: { name: "Rollback guest", phone: "+8801710000403" } },
    };
    const insert = vi
      .spyOn(MongoBookingRepository.prototype, "insert")
      .mockRejectedValueOnce(new Error("simulated booking insert failure"));
    try {
      expect((await bookInlineContact(world, body)).status).toBe(500);
    } finally {
      insert.mockRestore();
    }
    const contacts = await world.alice.call(
      "get",
      "/orgs/" + world.organizationA + "/contacts?search=Rollback&limit=100",
    );
    expect(contacts.status).toBe(200);
    expect(contacts.body.data).toEqual([]);
    // A successful retry proves none of the slot buckets were left reserved.
    expect((await bookInlineContact(world, body)).status).toBe(201);
  });
  it("creates the contact with the booking as a customer", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Stylist inline",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const created = await bookInlineContact(world, {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contact: { create: { name: "রহিম", phone: "+8801710000401" } },
    });
    expect(created.status).toBe(201);

    const contact = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${created.data.contactId}`,
    );
    expect(contact.status).toBe(200);
    const view = contact.body.data as ContactResponseShape;
    expect(view).toMatchObject({
      contactType: "PERSON",
      name: "রহিম",
      phoneE164: "+8801710000401",
      contactRoles: ["CUSTOMER"],
      source: "MANUAL",
      status: "ACTIVE",
    });
  });

  it("reuses the active contact that already has the phone", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    await createStylistResource(world.alice, world.organizationA, {
      locationId: world.locationA1,
      offeringId: offering.offeringId,
      name: "Stylist reuse",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
    });

    const first = await bookInlineContact(world, {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contact: { create: { name: "Karim", phone: "+8801710000402" } },
    });
    expect(first.status).toBe(201);

    const second = await bookInlineContact(world, {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T05:00:00.000Z",
      contact: { create: { name: "Karim", phone: "+8801710000402" } },
    });
    expect(second.status).toBe(201);
    expect(second.data.contactId).toBe(first.data.contactId);
  });

  it("refuses a body that sends neither a contactId nor a contact create", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const variantId = offering.variants[0]?.variantId;
    if (variantId === undefined) throw new Error("missing variant");

    const response = await bookInlineContact(world, {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
    });
    expect(response.status).toBe(400);
  });
});
