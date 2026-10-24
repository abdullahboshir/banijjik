import { describe, expect, it } from "vitest";
import {
  bookingBlockOf,
  calendarBoundsFromSchedules,
  sessionsOnDate,
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

describe("rentals and events on the calendar", () => {
  const rental = {
    bookingId: "r",
    bookingNumber: "R-1",
    kind: "RENTAL",
    startsAt: "2026-10-19T08:00:00.000Z",
    endsAt: "2026-10-22T05:00:00.000Z",
    status: "CONFIRMED",
  } as unknown as Parameters<typeof bookingBlockOf>[0]["booking"];
  const base = {
    label: "R-1",
    timeZone: "Asia/Dhaka",
    startMinutes: 6 * 60,
    endMinutes: 22 * 60,
    slotStepMinutes: 30,
  };

  it("draws a multi-day rental as a bar that runs off the grid on a middle day", () => {
    const block = bookingBlockOf({ ...base, booking: rental, businessDate: "2026-10-20" });
    expect(block).toMatchObject({
      continuesBefore: true,
      continuesAfter: true,
      topPx: 0,
      kind: "RENTAL",
    });
    expect(block.heightPx).toBe(((22 - 6) * 60 * 28) / 30);
  });

  it("starts the bar at the check-in time on the first day and ends it on the last day", () => {
    const first = bookingBlockOf({ ...base, booking: rental, businessDate: "2026-10-19" });
    const last = bookingBlockOf({ ...base, booking: rental, businessDate: "2026-10-22" });
    expect(first).toMatchObject({ continuesBefore: false, continuesAfter: true });
    expect(first.topPx).toBeGreaterThan(0);
    expect(last).toMatchObject({ continuesBefore: true, continuesAfter: false, topPx: 0 });
  });

  it("lists the event sessions that run on the shown day, earliest first", () => {
    const sessions = [
      { id: "late", startsAt: "2026-10-20T10:00:00.000Z", endsAt: "2026-10-20T11:00:00.000Z" },
      { id: "other-day", startsAt: "2026-10-21T10:00:00.000Z", endsAt: "2026-10-21T11:00:00.000Z" },
      { id: "early", startsAt: "2026-10-20T04:00:00.000Z", endsAt: "2026-10-20T05:00:00.000Z" },
    ];
    expect(sessionsOnDate(sessions, "2026-10-20", "Asia/Dhaka").map((s) => s.id)).toEqual([
      "early",
      "late",
    ]);
  });
});
