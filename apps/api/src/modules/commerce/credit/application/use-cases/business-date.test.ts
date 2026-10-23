import { describe, expect, it } from "vitest";
import { businessDateOf, businessDayBounds } from "./business-date.js";

describe("credit business-date", () => {
  it("Credit: an entry created at 23:30 UTC (05:30 Dhaka next day) has the Dhaka date", () => {
    // 23:30 UTC on 23 Oct 2026 is 05:30 Dhaka on 24 Oct 2026 (UTC+6).
    const instant = new Date("2026-10-23T23:30:00.000Z");
    const dhakaDate = businessDateOf(instant, "Asia/Dhaka");
    expect(dhakaDate).toBe("2026-10-24");

    const utcDate = businessDateOf(instant, "UTC");
    expect(utcDate).toBe("2026-10-23");
  });

  it("bounds a Dhaka business day by its local midnights, not the UTC day", () => {
    const { from, to } = businessDayBounds("2026-10-24", "Asia/Dhaka");
    expect(from.toISOString()).toBe("2026-10-23T18:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-24T18:00:00.000Z");

    // 05:30 Dhaka on 24 Oct (23:30 UTC on 23 Oct) is inside the Dhaka day of 24 Oct.
    const earlyMorning = new Date("2026-10-23T23:30:00.000Z");
    expect(earlyMorning >= from && earlyMorning < to).toBe(true);
  });

  it("keeps a DST day at its real length", () => {
    const { from, to } = businessDayBounds("2026-03-08", "America/New_York");
    expect(from.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});
