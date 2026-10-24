import { describe, expect, it } from "vitest";
import { rentalEndPreview } from "./rental-end-preview";

const TIME_ZONE = "Asia/Dhaka";

describe("rentalEndPreview", () => {
  it("adds whole hours for an hourly rental", () => {
    const preview = rentalEndPreview({
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 3,
      rental: { rateUnit: "HOUR" },
      timeZone: TIME_ZONE,
    });
    expect(preview?.endsAt).toBe("2026-11-01T07:00:00.000Z");
  });

  it("keeps the local time and moves the calendar day for a daily rental", () => {
    const preview = rentalEndPreview({
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 2,
      rental: { rateUnit: "DAY" },
      timeZone: TIME_ZONE,
    });
    expect(preview?.endsAt).toBe("2026-11-03T04:00:00.000Z");
  });

  it("starts at check-in time and ends at check-out time for a nightly rental", () => {
    const preview = rentalEndPreview({
      startsAt: "2026-11-01T04:00:00.000Z",
      quantity: 2,
      rental: { rateUnit: "NIGHT", checkInTime: "14:00", checkOutTime: "11:00" },
      timeZone: TIME_ZONE,
    });
    expect(preview).toEqual({
      startsAt: "2026-11-01T08:00:00.000Z",
      endsAt: "2026-11-03T05:00:00.000Z",
    });
  });

  it("shows nothing until a start and a positive number of units are chosen", () => {
    const rental = { rateUnit: "DAY" } as const;
    expect(rentalEndPreview({ startsAt: "", quantity: 1, rental, timeZone: TIME_ZONE })).toBeNull();
    expect(
      rentalEndPreview({
        startsAt: "2026-11-01T04:00:00.000Z",
        quantity: 0,
        rental,
        timeZone: TIME_ZONE,
      }),
    ).toBeNull();
  });
});
