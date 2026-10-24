import { describe, expect, it } from "vitest";
import {
  bookingsApiQuery,
  earlierRentalsApiQuery,
  parseBookingCalendarQuery,
  runningRentalsOf,
  todayInTimeZone,
} from "./booking-query";

describe("parseBookingCalendarQuery", () => {
  it("defaults the date to today in the organization timezone", () => {
    const query = parseBookingCalendarQuery({}, "Asia/Dhaka");
    expect(query.date).toBe(todayInTimeZone("Asia/Dhaka"));
  });

  it("keeps a valid location and date from the URL", () => {
    const query = parseBookingCalendarQuery(
      {
        location: "01900000-0000-7000-8000-000000000001",
        date: "2026-10-20",
      },
      "Asia/Dhaka",
    );
    expect(query.locationId).toBe("01900000-0000-7000-8000-000000000001");
    expect(query.date).toBe("2026-10-20");
  });
});

describe("bookingsApiQuery", () => {
  it("asks the API for one business day at a location", () => {
    expect(
      bookingsApiQuery("org-1", {
        locationId: "01900000-0000-7000-8000-000000000002",
        date: "2026-10-20",
      }),
    ).toBe(
      "/orgs/org-1/bookings?locationId=01900000-0000-7000-8000-000000000002&date=2026-10-20&page=1&limit=100",
    );
  });
});

describe("rentals that started before the shown day", () => {
  const query = { locationId: "01900000-0000-7000-8000-000000000002", date: "2026-10-20" };

  it("asks for bookings that started in the 31 days before the day", () => {
    const text = earlierRentalsApiQuery("org-1", query, "Asia/Dhaka");
    const params = new URL(text, "http://x").searchParams;
    expect(params.get("from")).toBe("2026-09-18T18:00:00.000Z");
    expect(params.get("to")).toBe("2026-10-19T17:59:59.999Z");
  });

  it("keeps only rentals that are still running on the day", () => {
    const earlier = [
      {
        bookingId: "running",
        kind: "RENTAL",
        endsAt: "2026-10-22T05:00:00.000Z",
        status: "CONFIRMED",
      },
      {
        bookingId: "ended",
        kind: "RENTAL",
        endsAt: "2026-10-19T05:00:00.000Z",
        status: "CONFIRMED",
      },
      {
        bookingId: "cancelled",
        kind: "RENTAL",
        endsAt: "2026-10-22T05:00:00.000Z",
        status: "CANCELLED",
      },
      {
        bookingId: "service",
        kind: "SERVICE",
        endsAt: "2026-10-22T05:00:00.000Z",
        status: "CONFIRMED",
      },
    ] as unknown as Parameters<typeof runningRentalsOf>[0];
    expect(runningRentalsOf(earlier, query, "Asia/Dhaka").map((b) => b.bookingId)).toEqual([
      "running",
    ]);
  });
});
