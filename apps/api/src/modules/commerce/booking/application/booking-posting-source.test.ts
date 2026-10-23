import { CURRENCY_CODE } from "@banijjik/contracts";
import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import {
  BOOKING_KIND,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  type Money,
} from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type BookingId,
  type ContactId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
} from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import { draftBookingCompleted, type BookingPostingSnapshot } from "../../accounting/index.js";
import { Booking, type BookingProps } from "../domain/booking.entity.js";
import { buildBookingPostingSource } from "./booking-posting-source.js";

const ORGANIZATION_ID = asId<OrganizationId>(newId());
/** 18:30 UTC on 23 October is 00:30 on 24 October in Dhaka (UTC+6): the local day rolls over. */
const LOCAL_MIDNIGHT_INSTANT = new Date("2026-10-23T18:30:00.000Z");

function money(amount: number): Money {
  return { amount, currency: CURRENCY_CODE.BDT };
}

type BookingOverrides = Partial<
  Pick<
    BookingProps,
    | "kind"
    | "status"
    | "startsAt"
    | "endsAt"
    | "updatedAt"
    | "depositRequired"
    | "cancellationFeeRetained"
  >
>;

function aBooking(input: BookingOverrides = {}): Booking {
  const createdOn = new Date("2026-10-20T08:00:00.000Z");
  const endsAt = input.endsAt ?? new Date(createdOn.getTime() + 60 * 60 * 1000);
  return Booking.rehydrate({
    bookingId: asId<BookingId>(newId()),
    organizationId: ORGANIZATION_ID,
    bookingNumber: "B-1",
    locationId: asId<LocationId>(newId()),
    contactId: asId<ContactId>(newId()),
    offeringId: asId<OfferingId>(newId()),
    variantId: newId(),
    kind: input.kind ?? BOOKING_KIND.SERVICE,
    depositRequired: input.depositRequired ?? money(500),
    startsAt: input.startsAt ?? createdOn,
    endsAt,
    blockedEndsAt: endsAt,
    resourceIds: [],
    providerMemberId: null,
    quantity: 1,
    price: {
      unitPrice: money(10_000),
      total: money(10_000),
      tax: money(0),
      currency: CURRENCY_CODE.BDT,
    },
    status: input.status ?? BOOKING_STATUS.COMPLETED,
    source: BOOKING_SOURCE.STAFF,
    note: null,
    holdExpiresAt: null,
    cancellationFeeRetained: input.cancellationFeeRetained ?? null,
    history: [],
    version: 3,
    createdAt: createdOn,
    updatedAt: input.updatedAt ?? createdOn,
    createdByUserId: null,
    updatedByUserId: null,
  });
}

/** The organization time zone arrives through the reader port, the way production wires it. */
function aSource(input: {
  readonly booking: Booking;
  readonly heldAdvance?: Money;
  readonly timeZone?: string;
}): {
  readonly source: ReturnType<typeof buildBookingPostingSource>;
  readonly advanceRequests: () => readonly unknown[];
} {
  const readHeldAdvance = vi.fn(async (): Promise<Money> => input.heldAdvance ?? money(0));
  const source = buildBookingPostingSource({
    bookings: { findById: async () => input.booking },
    advances: { readHeldAdvance },
    timeZone: { read: async () => input.timeZone ?? "Asia/Dhaka" },
  });
  return { source, advanceRequests: () => readHeldAdvance.mock.calls[0] ?? [] };
}

async function readSnapshot(
  source: ReturnType<typeof buildBookingPostingSource>,
  booking: Booking,
): Promise<BookingPostingSnapshot> {
  const snapshot = await source.readBooking(booking.bookingId);
  if (snapshot === undefined) throw new Error(`no posting snapshot for ${booking.bookingId}`);
  return snapshot;
}

describe("booking posting source", () => {
  it.each([BOOKING_KIND.SERVICE, BOOKING_KIND.RENTAL, BOOKING_KIND.EVENT])(
    "reports a %s booking with its own kind so it posts to that revenue account",
    async (kind) => {
      const booking = aBooking({ kind });
      const { source } = aSource({ booking });

      const snapshot = await readSnapshot(source, booking);

      expect(snapshot.kind).toBe(kind);
    },
  );

  it("dates a completed booking by the organization-local day its service ends on", async () => {
    const booking = aBooking({ status: BOOKING_STATUS.COMPLETED, endsAt: LOCAL_MIDNIGHT_INSTANT });
    const { source } = aSource({ booking, timeZone: "Asia/Dhaka" });

    const snapshot = await readSnapshot(source, booking);

    // Read in UTC the same instant is 2026-10-23 - the day this card stops posting on.
    expect(snapshot.businessDate).toBe("2026-10-24");
  });

  it("uses the organization's own time zone instead of assuming one", async () => {
    const booking = aBooking({ status: BOOKING_STATUS.COMPLETED, endsAt: LOCAL_MIDNIGHT_INSTANT });
    const { source } = aSource({ booking, timeZone: "America/Los_Angeles" });

    const snapshot = await readSnapshot(source, booking);

    expect(snapshot.businessDate).toBe("2026-10-23");
  });

  it("dates a cancellation fee by the status change, not by the original schedule", async () => {
    const booking = aBooking({
      status: BOOKING_STATUS.CANCELLED,
      endsAt: new Date("2026-10-23T06:00:00.000Z"),
      updatedAt: LOCAL_MIDNIGHT_INSTANT,
      cancellationFeeRetained: money(200),
    });
    const { source } = aSource({ booking });

    const snapshot = await readSnapshot(source, booking);

    expect(snapshot.businessDate).toBe("2026-10-24");
    expect(snapshot.cancellationFeeRetained).toEqual(money(200));
  });

  it("settles the advance the payment side reports as held, asked for this booking", async () => {
    const booking = aBooking({ status: BOOKING_STATUS.COMPLETED });
    const { source, advanceRequests } = aSource({ booking, heldAdvance: money(800) });

    const snapshot = await readSnapshot(source, booking);

    expect(snapshot.advancesToSettle).toEqual(money(800));
    expect(advanceRequests()).toEqual([
      {
        organizationId: ORGANIZATION_ID,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: booking.bookingId,
      },
    ]);
  });

  it("leaves no advance-settle entry when the required deposit was never paid", async () => {
    const booking = aBooking({ depositRequired: money(500) });
    const { source } = aSource({ booking, heldAdvance: money(0) });

    const snapshot = await readSnapshot(source, booking);
    const drafts = draftBookingCompleted(snapshot);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.postingKey).toBe(POSTING_KEY.booking_completed);
  });

  it("settles the whole held advance, including what was paid over the deposit", async () => {
    const booking = aBooking({ depositRequired: money(500) });
    const { source } = aSource({ booking, heldAdvance: money(800) });

    const snapshot = await readSnapshot(source, booking);
    const drafts = draftBookingCompleted(snapshot);
    const settle = drafts.find(
      (draft) => draft.postingKey === POSTING_KEY.booking_completed_settle_advances,
    );
    if (settle === undefined) throw new Error("no advance-settle entry drafted");

    expect(settle.lines[0]).toEqual({
      accountCode: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
      debit: money(800),
      credit: money(0),
    });
    expect(settle.lines[1]).toEqual({
      accountCode: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE,
      debit: money(0),
      credit: money(800),
    });
  });
});
