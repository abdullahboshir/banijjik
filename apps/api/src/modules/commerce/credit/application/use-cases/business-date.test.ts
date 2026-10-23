import { describe, expect, it } from "vitest";
import { businessDateOf } from "./business-date.js";

describe("credit business-date", () => {
  it("Credit: an entry created at 23:30 UTC (05:30 Dhaka next day) has the Dhaka date", () => {
    // 23:30 UTC on 23 Oct 2026 is 05:30 Dhaka on 24 Oct 2026 (UTC+6).
    const instant = new Date("2026-10-23T23:30:00.000Z");
    const dhakaDate = businessDateOf(instant, "Asia/Dhaka");
    expect(dhakaDate).toBe("2026-10-24");

    const utcDate = businessDateOf(instant, "UTC");
    expect(utcDate).toBe("2026-10-23");
  });
});
