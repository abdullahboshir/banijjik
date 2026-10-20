import { describe, expect, it } from "vitest";
import {
  filterByTimeOff,
  generateSlotStarts,
  slotBounds,
  slotFreeInBuckets,
} from "./availability.js";

describe("generateSlotStarts", () => {
  const schedule = [{ weekday: 7 as const, opensAt: "09:00", closesAt: "12:00" }];

  it("steps by slotStepMinutes inside weekly hours", () => {
    const slots = generateSlotStarts({
      businessDate: "2026-11-01",
      timeZone: "Asia/Dhaka",
      schedule,
      slotStepMinutes: 15,
      durationMinutes: 30,
      bufferAfterMinutes: 0,
      now: new Date("2026-10-01T00:00:00.000Z"),
      minNoticeMinutes: 0,
      maxAdvanceDays: 365,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.startsAt.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("respects min notice by dropping early slots", () => {
    const slots = generateSlotStarts({
      businessDate: "2026-11-01",
      timeZone: "Asia/Dhaka",
      schedule,
      slotStepMinutes: 60,
      durationMinutes: 30,
      bufferAfterMinutes: 0,
      now: new Date("2026-11-01T03:30:00.000Z"),
      minNoticeMinutes: 60,
      maxAdvanceDays: 365,
    });
    expect(slots.every((slot) => slot.startsAt >= new Date("2026-11-01T04:30:00.000Z"))).toBe(true);
  });

  it("includes buffer in blocked window but not customer-visible end", () => {
    const startsAt = new Date("2026-11-01T03:00:00.000Z");
    const { endsAt, blockedEndsAt } = slotBounds(startsAt, 30, 10);
    expect(endsAt.toISOString()).toBe("2026-11-01T03:30:00.000Z");
    expect(blockedEndsAt.toISOString()).toBe("2026-11-01T03:40:00.000Z");
  });
});

describe("slotFreeInBuckets", () => {
  it("fails when any bucket is at capacity", () => {
    const startsAt = new Date("2026-11-01T03:00:00.000Z");
    const blockedEndsAt = new Date("2026-11-01T03:30:00.000Z");
    const used = new Map<number, number>([[startsAt.getTime(), 1]]);
    expect(slotFreeInBuckets({ capacity: 1, usedByBucket: used, startsAt, blockedEndsAt })).toBe(
      false,
    );
  });
});

describe("filterByTimeOff", () => {
  it("removes slots overlapping resource time off", () => {
    const slot = {
      startsAt: new Date("2026-11-01T03:00:00.000Z"),
      endsAt: new Date("2026-11-01T03:30:00.000Z"),
      blockedEndsAt: new Date("2026-11-01T03:30:00.000Z"),
    };
    const filtered = filterByTimeOff(
      [slot],
      [
        {
          startsAt: new Date("2026-11-01T02:00:00.000Z"),
          endsAt: new Date("2026-11-01T04:00:00.000Z"),
        },
      ],
    );
    expect(filtered).toHaveLength(0);
  });
});
