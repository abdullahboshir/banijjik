import { AUDIT_ACTION, MODULE_KEY } from "@banijjik/contracts";
import {
  BOOKING_EVENT_SESSION_CANCEL_NOTE_KEY,
  BOOKING_KIND,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  BOOKING_TERMINATION_MODE,
  CANCEL_FEE_MODE,
  EVENT_SESSION_STATUS,
} from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type ContactId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import { bookingManifest } from "../module.manifest.js";
import { Booking } from "../domain/booking.entity.js";
import { EventSession } from "../domain/event-session.entity.js";
import { MongoBookingRepository } from "./mongo-booking.repositories.js";
import { MongoEventSessionRepository } from "./mongo-event-session.repository.js";
import { MongoResourceSlotUsageRepository } from "./mongo-slot-usage.repository.js";
import { buildExpireHoldsJob } from "../application/jobs/expire-holds.job.js";
import { buildMarkNoShowsJob } from "../application/jobs/mark-no-shows.job.js";
import { buildAutoCompleteJob } from "../application/jobs/auto-complete.job.js";
import { buildCancelEventSessionJob } from "../application/jobs/cancel-event-session-bookings.job.js";
import type { BookingEventPublisher } from "../application/use-cases/create-booking.use-case.js";
import type { DepositCheckPort } from "../application/ports/payment-ports.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

const zeroPrice = {
  unitPrice: { amount: 0, currency: "BDT" as const },
  total: { amount: 0, currency: "BDT" as const },
  tax: { amount: 0, currency: "BDT" as const },
  currency: "BDT" as const,
};

let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

function noopEvents(): BookingEventPublisher {
  return { publish: vi.fn(async () => undefined) };
}

function noopAudit(): AuditRecorder {
  return { record: vi.fn(async () => undefined) };
}

function configWithBooking(): OrgConfigService {
  return {
    current: async () => ({ modules: [MODULE_KEY.BOOKING] }),
  } as unknown as OrgConfigService;
}

function creditOnRequest(): DepositCheckPort & { settle: ReturnType<typeof vi.fn> } {
  const settle = vi.fn(async () => ({ feeRetained: null }));
  return {
    settle,
    isDepositSatisfied: async () => true,
    initializeSummary: async () => undefined,
    settleBookingTermination: settle as DepositCheckPort["settleBookingTermination"],
  };
}

/** One seat-holding booking, written straight through the repository. */
function seatBooking(input: {
  organizationId: OrganizationId;
  locationId: LocationId;
  eventSessionId: EventSessionId;
  quantity: number;
  status: (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): Booking {
  return Booking.createStaff({
    organizationId: input.organizationId,
    locationId: input.locationId,
    contactId: asId<ContactId>(newId()),
    offeringId: asId<OfferingId>(newId()),
    variantId: newId(),
    kind: BOOKING_KIND.EVENT,
    quantity: input.quantity,
    depositRequired: { amount: 0, currency: "BDT" },
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    blockedEndsAt: input.endsAt,
    resourceIds: [],
    providerMemberId: null,
    price: zeroPrice,
    status: input.status,
    bookingNumber: newId(),
    note: null,
    eventSessionId: input.eventSessionId,
    now: input.now,
    actorUserId: null,
  });
}

async function createSession(input: {
  organizationId: OrganizationId;
  locationId: LocationId;
  capacity: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<EventSession> {
  const sessions = new MongoEventSessionRepository();
  const session = EventSession.create({
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: asId<OfferingId>(newId()),
    variantId: newId(),
    resourceIds: [],
    capacity: input.capacity,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    now: new Date("2026-10-20T00:00:00Z"),
    actorUserId: null,
  });
  await sessions.insert(session);
  return session;
}

async function seatsSoldOf(eventSessionId: EventSessionId): Promise<number | undefined> {
  const stored = await new MongoEventSessionRepository().findById(eventSessionId);
  return stored?.toProps().seatsSold;
}

describe("event booking scheduled jobs", () => {
  it("gives an expired event hold its seats back once", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 5,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      const hold = Booking.createHold({
        organizationId,
        locationId,
        contactId: asId<ContactId>(newId()),
        offeringId: asId<OfferingId>(newId()),
        variantId: newId(),
        kind: BOOKING_KIND.EVENT,
        quantity: 2,
        depositRequired: { amount: 0, currency: "BDT" },
        startsAt,
        endsAt,
        blockedEndsAt: endsAt,
        resourceIds: [],
        providerMemberId: null,
        price: zeroPrice,
        holdExpiresAt: new Date("2026-10-25T00:00:00Z"),
        note: null,
        source: BOOKING_SOURCE.STOREFRONT,
        eventSessionId,
        now: new Date("2026-10-20T00:00:00Z"),
        actorUserId: null,
      });
      await bookings.insert(hold);
      await sessions.reserveSeats({ eventSessionId, seats: 2 });

      const job = buildExpireHoldsJob({
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        sessions,
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        clock: { now: () => new Date("2026-10-26T00:00:00Z") },
      });

      await job.run(organizationId, new Date("2026-10-26T00:00:00Z"));
      await job.run(organizationId, new Date("2026-10-26T00:00:00Z"));

      const expired = await bookings.findById(hold.bookingId);
      expect(expired?.status).toBe(BOOKING_STATUS.EXPIRED);
      expect(await seatsSoldOf(eventSessionId)).toBe(0);
    });
  });

  it("keeps the seat of an event booking the no-show job marks", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 5,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      const booking = seatBooking({
        organizationId,
        locationId,
        eventSessionId,
        quantity: 1,
        status: BOOKING_STATUS.CONFIRMED,
        startsAt,
        endsAt,
        now: startsAt,
      });
      await bookings.insert(booking);
      await sessions.reserveSeats({ eventSessionId, seats: 1 });

      const job = buildMarkNoShowsJob({
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        orgConfig: configWithBooking(),
        manifests: [bookingManifest],
        depositCheck: creditOnRequest(),
      });

      await job.run(organizationId, new Date("2026-11-01T06:00:00Z"));
      await job.run(organizationId, new Date("2026-11-01T06:00:00Z"));

      const marked = await bookings.findById(booking.bookingId);
      expect(marked?.status).toBe(BOOKING_STATUS.NO_SHOW);
      expect(await seatsSoldOf(eventSessionId)).toBe(1);
    });
  });

  it("cancels a session's bookings with a full refund and settles them once", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");
    const now = new Date("2026-10-26T00:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 4,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      const booking = seatBooking({
        organizationId,
        locationId,
        eventSessionId,
        quantity: 2,
        status: BOOKING_STATUS.CONFIRMED,
        startsAt,
        endsAt,
        now: startsAt,
      });
      await bookings.insert(booking);
      await sessions.reserveSeats({ eventSessionId, seats: 2 });
      const cancelledSession = session.cancel(now, null);
      await sessions.update(cancelledSession, session.toProps().version, session);

      const depositCheck = creditOnRequest();
      const audit = { record: vi.fn(async () => undefined) } satisfies AuditRecorder;
      const job = buildCancelEventSessionJob({
        sessions,
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        audit,
        depositCheck,
      });

      await job.run(organizationId, now);
      await job.run(organizationId, now);

      const settled = await bookings.findById(booking.bookingId);
      expect(settled?.status).toBe(BOOKING_STATUS.CANCELLED);
      expect(audit.record).toHaveBeenCalledWith({
        action: AUDIT_ACTION.BOOKING_CANCELLED,
        entityType: "booking",
        entityId: booking.bookingId,
        changes: { note: { to: BOOKING_EVENT_SESSION_CANCEL_NOTE_KEY } },
      });
      expect(await seatsSoldOf(eventSessionId)).toBe(0);
      expect(depositCheck.settle).toHaveBeenCalledTimes(1);
      expect(depositCheck.settle.mock.calls[0]?.[0]).toMatchObject({
        mode: BOOKING_TERMINATION_MODE.CANCEL,
        feeMode: CANCEL_FEE_MODE.NONE,
      });
      const stored = await sessions.findById(eventSessionId);
      expect(stored?.toProps().bookingsSettledAt).toEqual(now);
    });
  });

  it("settles 150 bookings of a cancelled session over two runs", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");
    const now = new Date("2026-10-26T00:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 200,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      for (let seat = 0; seat < 150; seat += 1) {
        await bookings.insert(
          seatBooking({
            organizationId,
            locationId,
            eventSessionId,
            quantity: 1,
            status: BOOKING_STATUS.CONFIRMED,
            startsAt,
            endsAt,
            now: startsAt,
          }),
        );
      }
      await sessions.reserveSeats({ eventSessionId, seats: 150 });
      await sessions.update(session.cancel(now, null), session.toProps().version, session);

      const job = buildCancelEventSessionJob({
        sessions,
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        audit: noopAudit(),
        depositCheck: creditOnRequest(),
      });

      await job.run(organizationId, now);
      const afterFirstRun = await sessions.findById(eventSessionId);
      expect(afterFirstRun?.toProps().bookingsSettledAt).toBeNull();
      expect(await seatsSoldOf(eventSessionId)).toBe(50);

      await job.run(organizationId, now);
      expect(await seatsSoldOf(eventSessionId)).toBe(0);
      expect(await bookings.listOpenForEventSession(eventSessionId)).toHaveLength(0);
      const settled = await sessions.findById(eventSessionId);
      expect(settled?.toProps().bookingsSettledAt).toEqual(now);
    });
  });

  it("logs a drifting booking and still cancels the others", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");
    const now = new Date("2026-10-26T00:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 10,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      // The counter only holds two seats, so releasing the five-seat booking is drift it must refuse.
      const drifting = seatBooking({
        organizationId,
        locationId,
        eventSessionId,
        quantity: 5,
        status: BOOKING_STATUS.CONFIRMED,
        startsAt: new Date("2026-11-01T03:00:00Z"),
        endsAt,
        now: startsAt,
      });
      const healthy = seatBooking({
        organizationId,
        locationId,
        eventSessionId,
        quantity: 1,
        status: BOOKING_STATUS.CONFIRMED,
        startsAt,
        endsAt,
        now: startsAt,
      });
      await bookings.insert(drifting);
      await bookings.insert(healthy);
      await sessions.reserveSeats({ eventSessionId, seats: 2 });
      await sessions.update(session.cancel(now, null), session.toProps().version, session);

      const job = buildCancelEventSessionJob({
        sessions,
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        audit: noopAudit(),
        depositCheck: creditOnRequest(),
      });
      await job.run(organizationId, now);

      expect((await bookings.findById(drifting.bookingId))?.status).toBe(BOOKING_STATUS.CONFIRMED);
      expect((await bookings.findById(healthy.bookingId))?.status).toBe(BOOKING_STATUS.CANCELLED);
      const stored = await sessions.findById(eventSessionId);
      expect(stored?.toProps().bookingsSettledAt).toBeNull();
      expect(await seatsSoldOf(eventSessionId)).toBe(1);
    });
  });

  it("completes an ended session and its checked-in event booking, then does nothing again", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");
    const now = new Date("2026-11-01T05:10:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const session = await createSession({
        organizationId,
        locationId,
        capacity: 5,
        startsAt,
        endsAt,
      });
      const eventSessionId = session.toProps().eventSessionId;
      const bookings = new MongoBookingRepository();
      const checkedIn = seatBooking({
        organizationId,
        locationId,
        eventSessionId,
        quantity: 1,
        status: BOOKING_STATUS.CHECKED_IN,
        startsAt,
        endsAt,
        now: startsAt,
      });
      await bookings.insert(checkedIn);
      await sessions.reserveSeats({ eventSessionId, seats: 1 });

      const job = buildAutoCompleteJob({
        bookings,
        sessions,
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        audit: noopAudit(),
        orgConfig: configWithBooking(),
        manifests: [bookingManifest],
      });

      await job.run(organizationId, now);
      await job.run(organizationId, now);

      expect((await bookings.findById(checkedIn.bookingId))?.status).toBe(BOOKING_STATUS.COMPLETED);
      const stored = await sessions.findById(eventSessionId);
      expect(stored?.toProps().status).toBe(EVENT_SESSION_STATUS.COMPLETED);
      expect(stored?.toProps().version).toBe(2);
      expect(await seatsSoldOf(eventSessionId)).toBe(1);
    });
  });

  it("lists unsettled cancellations in eventSessionId order after the cursor", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const now = new Date("2026-10-26T00:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const createdIds: EventSessionId[] = [];
      for (let index = 0; index < 4; index += 1) {
        // Later sessions start earlier, so a startsAt sort would give the opposite order.
        const session = await createSession({
          organizationId,
          locationId,
          capacity: 1,
          startsAt: new Date(Date.UTC(2026, 10, 20 - index, 4)),
          endsAt: new Date(Date.UTC(2026, 10, 20 - index, 5)),
        });
        await sessions.update(session.cancel(now, null), session.toProps().version, session);
        createdIds.push(session.toProps().eventSessionId);
      }

      const firstPage = await sessions.listUnsettledCancellations({
        afterEventSessionId: null,
        limit: 2,
      });
      const secondPage = await sessions.listUnsettledCancellations({
        afterEventSessionId: firstPage[1]?.toProps().eventSessionId ?? null,
        limit: 2,
      });

      const listed = [...firstPage, ...secondPage].map((row) => row.toProps().eventSessionId);
      expect(listed).toEqual([...createdIds].sort());
    });
  });

  it("the session-cancel job settles a later session even when ten earlier sessions keep failing", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00Z");
    const endsAt = new Date("2026-11-01T05:00:00Z");
    const now = new Date("2026-10-26T00:00:00Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const sessions = new MongoEventSessionRepository();
      const bookings = new MongoBookingRepository();
      // The counter holds no seats, so releasing the booking is drift and the session never settles.
      for (let index = 0; index < 10; index += 1) {
        const failing = await createSession({
          organizationId,
          locationId,
          capacity: 5,
          startsAt,
          endsAt,
        });
        const failingId = failing.toProps().eventSessionId;
        await bookings.insert(
          seatBooking({
            organizationId,
            locationId,
            eventSessionId: failingId,
            quantity: 1,
            status: BOOKING_STATUS.CONFIRMED,
            startsAt,
            endsAt,
            now: startsAt,
          }),
        );
        await sessions.update(failing.cancel(now, null), failing.toProps().version, failing);
      }
      const later = await createSession({
        organizationId,
        locationId,
        capacity: 5,
        startsAt,
        endsAt,
      });
      const laterId = later.toProps().eventSessionId;
      await sessions.update(later.cancel(now, null), later.toProps().version, later);

      const job = buildCancelEventSessionJob({
        sessions,
        bookings,
        slots: new MongoResourceSlotUsageRepository(),
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        audit: noopAudit(),
        depositCheck: creditOnRequest(),
        sessionPageSize: 5,
      });
      await job.run(organizationId, now);

      const stored = await sessions.findById(laterId);
      expect(stored?.toProps().bookingsSettledAt).toEqual(now);
    });
  });
});
