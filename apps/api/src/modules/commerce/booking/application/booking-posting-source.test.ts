import { CURRENCY_CODE } from "@banijjik/contracts";
import {
  BOOKING_KIND,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  type BookingKind,
} from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type BookingId,
  type ContactId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Booking } from "../domain/booking.entity.js";
import { buildBookingPostingSource } from "./booking-posting-source.js";

function completedBooking(kind: BookingKind): Booking {
  const now = new Date("2026-10-23T08:00:00.000Z");
  const money = (amount: number) => ({ amount, currency: CURRENCY_CODE.BDT });
  return Booking.rehydrate({
    bookingId: asId<BookingId>(newId()),
    organizationId: asId<OrganizationId>(newId()),
    bookingNumber: "B-1",
    locationId: asId<LocationId>(newId()),
    contactId: asId<ContactId>(newId()),
    offeringId: asId<OfferingId>(newId()),
    variantId: newId(),
    kind,
    depositRequired: money(0),
    startsAt: now,
    endsAt: new Date(now.getTime() + 60 * 60 * 1000),
    blockedEndsAt: new Date(now.getTime() + 60 * 60 * 1000),
    resourceIds: [],
    providerMemberId: null,
    quantity: 1,
    price: {
      unitPrice: money(10_000),
      total: money(10_000),
      tax: money(0),
      currency: CURRENCY_CODE.BDT,
    },
    status: BOOKING_STATUS.COMPLETED,
    source: BOOKING_SOURCE.STAFF,
    note: null,
    holdExpiresAt: null,
    history: [],
    version: 3,
    createdAt: now,
    updatedAt: now,
    createdByUserId: null,
    updatedByUserId: null,
  });
}

describe("booking posting source", () => {
  it.each([BOOKING_KIND.SERVICE, BOOKING_KIND.RENTAL, BOOKING_KIND.EVENT])(
    "reports a %s booking with its own kind so it posts to that revenue account",
    async (kind) => {
      const booking = completedBooking(kind);
      const source = buildBookingPostingSource({
        bookings: { findById: async () => booking },
      });

      const snapshot = await source.readBooking(booking.bookingId);

      expect(snapshot?.kind).toBe(kind);
    },
  );
});
