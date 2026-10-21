import { describe, expect, it } from "vitest";
import {
  bookingBlockOf,
  calendarBoundsFromSchedules,
  snapMinutesToSlot,
} from "./booking-calendar-layout";

describe("calendarBoundsFromSchedules", () => {
  it("widens the grid to cover resource hours", () => {
    const bounds = calendarBoundsFromSchedules([
      [{ weekday: 1, opensAt: "09:00", closesAt: "17:00" }],
    ]);
    expect(bounds.startMinutes).toBe(6 * 60);
    expect(bounds.endMinutes).toBe(22 * 60);
  });
});

describe("snapMinutesToSlot", () => {
  it("rounds to the configured step", () => {
    expect(snapMinutesToSlot(17, 15)).toBe(15);
    expect(snapMinutesToSlot(7, 15)).toBe(0);
  });
});

describe("bookingBlockOf", () => {
  it("places a booking block on the grid", () => {
    const block = bookingBlockOf({
      booking: {
        bookingId: "01900000-0000-7000-8000-000000000099",
        bookingNumber: "B-1",
        locationId: "loc",
        contactId: "c",
        offeringId: "o",
        variantId: "v",
        kind: "SERVICE",
        depositRequired: { amount: 0, currency: "BDT" },
        startsAt: "2026-10-20T03:30:00.000Z",
        endsAt: "2026-10-20T04:30:00.000Z",
        resourceIds: ["r"],
        providerMemberId: null,
        quantity: 1,
        price: {
          unitPrice: { amount: 100, currency: "BDT" },
          total: { amount: 100, currency: "BDT" },
          tax: { amount: 0, currency: "BDT" },
          currency: "BDT",
        },
        status: "CONFIRMED",
        source: "STAFF",
        note: null,
        holdExpiresAt: null,
        history: [],
        version: 1,
        createdAt: "2026-10-20T03:00:00.000Z",
        updatedAt: "2026-10-20T03:00:00.000Z",
      },
      label: "B-1",
      businessDate: "2026-10-20",
      timeZone: "Asia/Dhaka",
      startMinutes: 9 * 60,
      slotStepMinutes: 15,
    });
    expect(block.topPx).toBeGreaterThan(0);
    expect(block.heightPx).toBeGreaterThan(0);
  });
});
