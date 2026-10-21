import { describe, expect, it } from "vitest";
import { bookingsApiQuery, parseBookingCalendarQuery, todayInTimeZone } from "./booking-query";

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
