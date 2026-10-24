import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  publishBookableEvent,
  publishBookableService,
} from "../../../../test-support/booking-api-world.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
/** COACHING is the seeded template that sells EVENT offerings, so events can be booked here. */
const COACHING = { industryTemplateKey: "COACHING" };

const SESSION_START = "2026-11-01T04:00:00.000Z";
const SESSION_END = "2026-11-01T05:00:00.000Z";
/** The harness clock starts on 2026-10-11T08:00Z and only moves forward, so the sales-close test
 * uses the next morning: its clock jumps stay in hours, which keeps the sign-in valid. */
const SALES_CLOSE_START = "2026-10-12T10:00:00.000Z";
const SALES_CLOSE_END = "2026-10-12T11:00:00.000Z";

type Offering = { offeringId: string; variants: { variantId: string }[] };

/** A test that needs a seat class by position fails loudly instead of sending an undefined id. */
function variantId(offering: Offering, index = 0): string {
  const variant = offering.variants[index];
  if (variant === undefined) throw new Error(`offering has no variant at index ${index}`);
  return variant.variantId;
}

function bookingsPath(organizationId: string): string {
  return `/orgs/${organizationId}/bookings`;
}

function sessionsPath(organizationId: string): string {
  return `/orgs/${organizationId}/event-sessions`;
}

/** COACHING makes these two contact fields required (ADR-073), so a seat buyer carries them. */
const COACHING_CONTACT_FIELDS = {
  class_level: "CLASS_5",
  guardian: { create: { name: "Guardian", phone: "01712349001" } },
};

async function createContact(
  actor: ApiActor,
  organizationId: string,
  customFields: object = {},
): Promise<string> {
  const contact = await actor.call("post", `/orgs/${organizationId}/contacts`, {
    contactType: "PERSON",
    name: "Seat Customer",
    phoneE164: "+8801710000011",
    contactRoles: ["CUSTOMER"],
    customFields,
  });
  expect(contact.status).toBe(201);
  return (contact.body.data as { contactId: string }).contactId;
}

async function createSession(
  actor: ApiActor,
  organizationId: string,
  offering: Offering,
  input: {
    readonly locationId: string;
    readonly variantId?: string;
    readonly capacity?: number;
    readonly startsAt?: string;
    readonly endsAt?: string;
  },
): Promise<string> {
  const created = await actor.call("post", sessionsPath(organizationId), {
    offeringId: offering.offeringId,
    variantId: input.variantId ?? offering.variants[0]?.variantId,
    locationId: input.locationId,
    startsAt: input.startsAt ?? SESSION_START,
    endsAt: input.endsAt ?? SESSION_END,
    capacity: input.capacity ?? 10,
    resourceIds: [],
  });
  expect(created.status).toBe(201);
  return (created.body.data as { eventSessionId: string }).eventSessionId;
}

async function seatsSold(eventSessionId: string): Promise<number> {
  const row = await harness.connections.tenantShared
    .collection("event_sessions")
    .findOne({ eventSessionId });
  return Number(row?.seatsSold ?? -1);
}

function advanceClockTo(iso: string): void {
  const now = harness.clock.now().getTime();
  harness.clock.advanceSeconds(Math.round((new Date(iso).getTime() - now) / 1000));
}

async function eventWorld(): Promise<{
  world: TwoOrganizations;
  offering: Offering;
  contactId: string;
  locationId: string;
}> {
  const world = await worldFor(harness, RETAIL, COACHING);
  const offering = await publishBookableEvent(world.alice, world.organizationA);
  const contactId = await createContact(world.alice, world.organizationA, COACHING_CONTACT_FIELDS);
  return { world, offering, contactId, locationId: world.locationA1 };
}

function eventBookingBody(input: {
  offering: Offering;
  locationId: string;
  contactId: string;
  eventSessionId: string;
  quantity?: number;
  variantId?: string;
  startsAt?: string;
}) {
  return {
    offeringId: input.offering.offeringId,
    variantId: input.variantId ?? input.offering.variants[0]?.variantId,
    locationId: input.locationId,
    startsAt: input.startsAt ?? SESSION_START,
    eventSessionId: input.eventSessionId,
    ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
    contactId: input.contactId,
  };
}

describe("event booking API", () => {
  it("books two seats and copies the session times onto the booking", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      capacity: 6,
    });

    const created = await world.alice.call("post", bookingsPath(world.organizationA), {
      ...eventBookingBody({ offering, locationId, contactId, eventSessionId }),
      quantity: 2,
    });
    expect(created.status).toBe(201);
    const booking = created.body.data as Record<string, unknown>;
    expect(booking).toMatchObject({
      kind: "EVENT",
      quantity: 2,
      status: "CONFIRMED",
      startsAt: SESSION_START,
      endsAt: SESSION_END,
      eventSessionId,
      providerMemberId: null,
    });
    expect(booking._id).toBeUndefined();
    expect((booking.price as { total: { amount: number } }).total.amount).toBe(200000);
    expect(booking.resourceIds).toEqual([]);
    expect(await seatsSold(eventSessionId)).toBe(2);
  });

  it("refuses an event booking without a session", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const created = await world.alice.call("post", bookingsPath(world.organizationA), {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId,
      startsAt: SESSION_START,
      quantity: 1,
      contactId,
    });
    expect(created.status).toBe(422);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_REQUIRED");
  });

  it("refuses a session id on a service booking", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const contactId = await createContact(world.alice, world.organizationA);

    const created = await world.alice.call("post", bookingsPath(world.organizationA), {
      offeringId: offering.offeringId,
      variantId: offering.variants[0]?.variantId,
      locationId: world.locationA1,
      startsAt: SESSION_START,
      contactId,
      eventSessionId: newId(),
    });
    expect(created.status).toBe(400);
    expect(created.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a session that belongs to another offering", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const other = await publishBookableEvent(world.alice, world.organizationA, {
      name: "Other workshop",
    });

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering: other, locationId, contactId, eventSessionId }),
    );
    expect(created.status).toBe(422);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_NOT_OPEN");
  });

  it("refuses a session of another seat class", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const offering = await publishBookableEvent(world.alice, world.organizationA, {
      variantCount: 2,
    });
    const contactId = await createContact(
      world.alice,
      world.organizationA,
      COACHING_CONTACT_FIELDS,
    );
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId: world.locationA1,
      variantId: variantId(offering),
    });

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({
        offering,
        locationId: world.locationA1,
        contactId,
        eventSessionId,
        variantId: variantId(offering, 1),
      }),
    );
    expect(created.status).toBe(422);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_NOT_OPEN");
  });

  it("refuses a session held at another location", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId: world.locationA2,
    });

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    expect(created.status).toBe(422);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_NOT_OPEN");
  });

  it.each(["CANCELLED", "COMPLETED"])("refuses a %s session", async (status) => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    if (status === "CANCELLED") {
      const cancelled = await world.alice.call(
        "post",
        `${sessionsPath(world.organizationA)}/${eventSessionId}/cancel`,
        { version: 1 },
      );
      expect(cancelled.status).toBe(200);
    } else {
      await harness.connections.tenantShared
        .collection("event_sessions")
        .updateOne({ eventSessionId }, { $set: { status } });
    }

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    expect(created.status).toBe(422);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_NOT_OPEN");
  });

  it("closes sales before the session starts", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const offering = await publishBookableEvent(world.alice, world.organizationA, {
      salesCloseMinutesBefore: 60,
    });
    const contactId = await createContact(
      world.alice,
      world.organizationA,
      COACHING_CONTACT_FIELDS,
    );
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId: world.locationA1,
      startsAt: SALES_CLOSE_START,
      endsAt: SALES_CLOSE_END,
    });
    const body = eventBookingBody({
      offering,
      locationId: world.locationA1,
      contactId,
      eventSessionId,
      startsAt: SALES_CLOSE_START,
    });

    advanceClockTo("2026-10-12T08:59:00.000Z");
    const beforeClose = await world.alice.call("post", bookingsPath(world.organizationA), body);
    expect(beforeClose.status).toBe(201);

    advanceClockTo("2026-10-12T09:01:00.000Z");
    const afterClose = await world.alice.call("post", bookingsPath(world.organizationA), body);
    expect(afterClose.status).toBe(422);
    expect(afterClose.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SALES_CLOSED");
  });

  it("refuses more seats than the session has left", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      capacity: 3,
    });

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId, quantity: 4 }),
    );
    expect(created.status).toBe(409);
    expect(created.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SOLD_OUT");
    expect(await seatsSold(eventSessionId)).toBe(0);
  });

  it("lets one of two parallel bookings take the last seat", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      capacity: 1,
    });
    const body = eventBookingBody({ offering, locationId, contactId, eventSessionId });

    const responses = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: bookingsPath(world.organizationA),
        idempotencyKey: newId(),
        body,
      }),
      world.alice.callWith({
        method: "post",
        path: bookingsPath(world.organizationA),
        idempotencyKey: newId(),
        body,
      }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await seatsSold(eventSessionId)).toBe(1);
  });

  it("holds seats in a session", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });

    const held = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/holds`,
      eventBookingBody({ offering, locationId, contactId, eventSessionId, quantity: 2 }),
    );
    expect(held.status).toBe(201);
    expect(held.body.data).toMatchObject({ kind: "EVENT", status: "HELD", quantity: 2 });
    expect(await seatsSold(eventSessionId)).toBe(2);
  });

  it("moves an event booking to another session and shifts the seats", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const from = await createSession(world.alice, world.organizationA, offering, { locationId });
    const to = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      startsAt: "2026-11-02T04:00:00.000Z",
      endsAt: "2026-11-02T05:00:00.000Z",
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId: from, quantity: 3 }),
    );
    expect(created.status).toBe(201);
    const booking = created.body.data as { bookingId: string; version: number };

    const moved = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      { version: booking.version, eventSessionId: to },
    );
    expect(moved.status).toBe(200);
    expect(moved.body.data).toMatchObject({
      eventSessionId: to,
      startsAt: "2026-11-02T04:00:00.000Z",
      endsAt: "2026-11-02T05:00:00.000Z",
    });
    expect(await seatsSold(from)).toBe(0);
    expect(await seatsSold(to)).toBe(3);
  });

  it("refuses an event reschedule that gives a start time instead of a session", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    expect(created.status).toBe(201);
    const booking = created.body.data as { bookingId: string; version: number };

    const moved = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      { version: booking.version, startsAt: "2026-11-02T04:00:00.000Z" },
    );
    expect(moved.status).toBe(422);
    expect(moved.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SESSION_REQUIRED");
    expect(await seatsSold(eventSessionId)).toBe(1);
  });

  it("refuses a reschedule that gives both a session and a start time", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    const booking = created.body.data as { bookingId: string; version: number };

    const moved = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      {
        version: booking.version,
        eventSessionId,
        startsAt: "2026-11-02T04:00:00.000Z",
      },
    );
    expect(moved.status).toBe(400);
    expect(moved.body.error?.code).toBe("VALIDATION_ERROR");
    expect(await seatsSold(eventSessionId)).toBe(1);
  });

  it("refuses a reschedule to the same session", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    const booking = created.body.data as { bookingId: string; version: number };

    const moved = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      { version: booking.version, eventSessionId },
    );
    expect(moved.status).toBe(422);
    expect(moved.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SAME_SESSION");
    expect(await seatsSold(eventSessionId)).toBe(1);
  });

  it("refuses a reschedule into a full session and leaves both counters alone", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const from = await createSession(world.alice, world.organizationA, offering, { locationId });
    const to = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      startsAt: "2026-11-02T04:00:00.000Z",
      endsAt: "2026-11-02T05:00:00.000Z",
      capacity: 1,
    });
    const taken = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId: to }),
    );
    expect(taken.status).toBe(201);

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId: from }),
    );
    const booking = created.body.data as { bookingId: string; version: number };

    const moved = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      { version: booking.version, eventSessionId: to },
    );
    expect(moved.status).toBe(409);
    expect(moved.body.error?.details?.ruleKey).toBe("BOOKING_EVENT_SOLD_OUT");
    expect(await seatsSold(from)).toBe(1);
    expect(await seatsSold(to)).toBe(1);
  });

  it("keeps both seat counters exact across a loop of books, holds, cancels and reschedules", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const first = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      capacity: 20,
    });
    const second = await createSession(world.alice, world.organizationA, offering, {
      locationId,
      capacity: 20,
      startsAt: "2026-11-02T04:00:00.000Z",
      endsAt: "2026-11-02T05:00:00.000Z",
    });

    const live: { bookingId: string; version: number; session: string; seats: number }[] = [];
    const expectSeatCounters = async (): Promise<void> => {
      const seatsIn = (session: string) =>
        live.filter((booking) => booking.session === session).reduce((sum, b) => sum + b.seats, 0);
      expect(await seatsSold(first)).toBe(seatsIn(first));
      expect(await seatsSold(second)).toBe(seatsIn(second));
    };

    for (let round = 0; round < 3; round += 1) {
      const from = round % 2 === 0 ? first : second;
      const to = round % 2 === 0 ? second : first;
      const booked = await world.alice.call(
        "post",
        bookingsPath(world.organizationA),
        eventBookingBody({
          offering,
          locationId,
          contactId,
          eventSessionId: from,
          quantity: round + 1,
        }),
      );
      expect(booked.status).toBe(201);
      const data = booked.body.data as { bookingId: string; version: number };
      const movedBooking = { ...data, session: from, seats: round + 1 };
      live.push(movedBooking);

      const held = await world.alice.call(
        "post",
        `${bookingsPath(world.organizationA)}/holds`,
        eventBookingBody({ offering, locationId, contactId, eventSessionId: first, quantity: 2 }),
      );
      expect(held.status).toBe(201);
      const heldData = held.body.data as { bookingId: string; version: number };

      const moved = await world.alice.call(
        "post",
        `${bookingsPath(world.organizationA)}/${movedBooking.bookingId}/reschedule`,
        { version: movedBooking.version, eventSessionId: to },
      );
      expect(moved.status).toBe(200);
      movedBooking.session = to;
      movedBooking.version = (moved.body.data as { version: number }).version;

      const cancelled = await world.alice.call(
        "post",
        `${bookingsPath(world.organizationA)}/${heldData.bookingId}/cancel`,
        { version: heldData.version, reason: "Hold given up" },
      );
      expect(cancelled.status).toBe(200);
      await expectSeatCounters();
    }
  });

  it("releases the seats once when a booking is cancelled", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId, quantity: 2 }),
    );
    const booking = created.body.data as { bookingId: string; version: number };

    const cancelled = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/cancel`,
      { version: booking.version, reason: "Customer changed plans" },
    );
    expect(cancelled.status).toBe(200);
    expect(await seatsSold(eventSessionId)).toBe(0);

    const again = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/cancel`,
      { version: booking.version, reason: "Customer changed plans" },
    );
    expect(again.status).toBe(409);
    expect(await seatsSold(eventSessionId)).toBe(0);
  });

  it("keeps the seats when a missed event booking is marked a no-show", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    const booking = created.body.data as { bookingId: string; version: number };

    const marked = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/no-show`,
      { version: booking.version },
    );
    expect(marked.status).toBe(200);
    expect(marked.body.data.status).toBe("NO_SHOW");
    expect(await seatsSold(eventSessionId)).toBe(1);
  });

  it("enforces permission, organization and location limits on event bookings", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });
    const body = eventBookingBody({ offering, locationId, contactId, eventSessionId });

    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const deniedCreate = await viewer.call("post", bookingsPath(world.organizationA), body);
    expect(deniedCreate.status).toBe(403);
    const deniedHold = await viewer.call(
      "post",
      `${bookingsPath(world.organizationA)}/holds`,
      body,
    );
    expect(deniedHold.status).toBe(403);
    const crossOrg = await world.bob.call("post", bookingsPath(world.organizationA), body);
    expect(crossOrg.status).toBe(404);

    const created = await world.alice.call("post", bookingsPath(world.organizationA), body);
    expect(created.status).toBe(201);
    const booking = created.body.data as { bookingId: string; version: number };

    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const otherLocation = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);
    const crossLocationWrite = await otherLocation.actor.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/reschedule`,
      { version: booking.version, eventSessionId },
    );
    expect(crossLocationWrite.status).toBeGreaterThanOrEqual(400);

    const crossLocationCreate = await world.sam.call("post", bookingsPath(world.organizationA), {
      ...body,
      locationId: world.locationA2,
    });
    expect(crossLocationCreate.status).toBe(403);
    expect(crossLocationCreate.body.error?.code).toBe("LOCATION_FORBIDDEN");
  });

  it("will not confirm an event booking whose deposit is unpaid", async () => {
    const { world, offering, contactId, locationId } = await eventWorld();
    const settings = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "booking.deposit.required", value: "FULL" }],
    });
    expect(settings.status).toBe(200);
    const eventSessionId = await createSession(world.alice, world.organizationA, offering, {
      locationId,
    });

    const created = await world.alice.call(
      "post",
      bookingsPath(world.organizationA),
      eventBookingBody({ offering, locationId, contactId, eventSessionId }),
    );
    expect(created.status).toBe(201);
    const booking = created.body.data as { bookingId: string; status: string; version: number };
    expect(booking.status).toBe("REQUESTED");

    const confirmed = await world.alice.call(
      "post",
      `${bookingsPath(world.organizationA)}/${booking.bookingId}/confirm`,
      { version: booking.version },
    );
    expect(confirmed.status).toBe(422);
    expect(confirmed.body.error?.details?.ruleKey).toBe("errors.deposit_required");
    expect(await seatsSold(eventSessionId)).toBe(1);
  });
});
