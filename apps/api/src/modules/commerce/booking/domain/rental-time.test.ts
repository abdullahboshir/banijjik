import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type { RentalDetails } from "@banijjik/contracts/catalog";
import { describe, expect, it } from "vitest";
import { computeRentalTime } from "./rental-time.js";

describe("rental time domain model", () => {
  const dhakaZone = "Asia/Dhaka";
  const newYorkZone = "America/New_York";

  describe("HOUR rateUnit", () => {
    const hourlyRental: RentalDetails = {
      rateUnit: "HOUR",
      minUnits: 1,
      maxUnits: 8,
      resourceTypeKeys: ["ROOM"],
    };

    it("computes endsAt exactly quantity hours later", () => {
      const startsAt = new Date("2026-11-01T10:00:00.000Z");
      const result = computeRentalTime({
        startsAt,
        quantity: 3,
        rental: hourlyRental,
        timeZone: dhakaZone,
      });

      expect(result.startsAt.toISOString()).toBe("2026-11-01T10:00:00.000Z");
      expect(result.endsAt.toISOString()).toBe("2026-11-01T13:00:00.000Z");
      expect(result.blockedEndsAt.toISOString()).toBe("2026-11-01T13:00:00.000Z");
      expect(result.quantity).toBe(3);
    });

    it("defaults quantity to minUnits when omitted", () => {
      const startsAt = new Date("2026-11-01T10:00:00.000Z");
      const result = computeRentalTime({
        startsAt,
        rental: hourlyRental,
        timeZone: dhakaZone,
      });
      expect(result.quantity).toBe(1);
      expect(result.endsAt.toISOString()).toBe("2026-11-01T11:00:00.000Z");
    });
  });

  describe("DAY rateUnit and DST handling", () => {
    const dailyRental: RentalDetails = {
      rateUnit: "DAY",
      minUnits: 1,
      maxUnits: 31,
      resourceTypeKeys: ["HALL"],
    };

    it("computes calendar days later in standard timezone", () => {
      const startsAt = new Date("2026-11-01T04:00:00.000Z"); // 10:00 Dhaka
      const result = computeRentalTime({
        startsAt,
        quantity: 2,
        rental: dailyRental,
        timeZone: dhakaZone,
      });

      expect(result.startsAt.toISOString()).toBe("2026-11-01T04:00:00.000Z");
      expect(result.endsAt.toISOString()).toBe("2026-11-03T04:00:00.000Z");
      expect(result.quantity).toBe(2);
    });

    it("preserves local wall-clock time across DST fall-back day (25 hours)", () => {
      // Oct 31 -> Nov 1, 2026 is DST fall-back in America/New_York (2 AM EDT -> 1 AM EST on Nov 1)
      // 10:00 local time on Oct 31 is 14:00 UTC (EDT = UTC-4)
      const startsAt = new Date("2026-10-31T14:00:00.000Z");
      const result = computeRentalTime({
        startsAt,
        quantity: 1,
        rental: dailyRental,
        timeZone: newYorkZone,
      });

      // 10:00 local time on Nov 1 is 15:00 UTC (EST = UTC-5)
      expect(result.startsAt.toISOString()).toBe("2026-10-31T14:00:00.000Z");
      expect(result.endsAt.toISOString()).toBe("2026-11-01T15:00:00.000Z");
      const elapsedHours = (result.endsAt.getTime() - result.startsAt.getTime()) / (3600 * 1000);
      expect(elapsedHours).toBe(25);
    });

    it("preserves local wall-clock time across DST spring-forward day (23 hours)", () => {
      // Mar 7 -> Mar 8, 2026 is DST spring-forward in America/New_York (2 AM EST -> 3 AM EDT on Mar 8)
      // 10:00 local time on Mar 7 is 15:00 UTC (EST = UTC-5)
      const startsAt = new Date("2026-03-07T15:00:00.000Z");
      const result = computeRentalTime({
        startsAt,
        quantity: 1,
        rental: dailyRental,
        timeZone: newYorkZone,
      });

      // 10:00 local time on Mar 8 is 14:00 UTC (EDT = UTC-4)
      expect(result.startsAt.toISOString()).toBe("2026-03-07T15:00:00.000Z");
      expect(result.endsAt.toISOString()).toBe("2026-03-08T14:00:00.000Z");
      const elapsedHours = (result.endsAt.getTime() - result.startsAt.getTime()) / (3600 * 1000);
      expect(elapsedHours).toBe(23);
    });
  });

  describe("NIGHT rateUnit", () => {
    const nightRental: RentalDetails = {
      rateUnit: "NIGHT",
      minUnits: 1,
      maxUnits: 14,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      resourceTypeKeys: ["ROOM"],
    };

    it("aligns startsAt to checkInTime and endsAt to checkOutTime quantity days later", () => {
      // Requested timestamp is arbitrary daytime in Dhaka (e.g. 09:00 UTC = 15:00 Dhaka on Nov 1)
      const requested = new Date("2026-11-01T09:00:00.000Z");
      const result = computeRentalTime({
        startsAt: requested,
        quantity: 2,
        rental: nightRental,
        timeZone: dhakaZone,
      });

      // Check-in: 2026-11-01 at 14:00 Dhaka = 08:00 UTC
      expect(result.startsAt.toISOString()).toBe("2026-11-01T08:00:00.000Z");
      // Check-out: 2026-11-03 at 11:00 Dhaka = 05:00 UTC
      expect(result.endsAt.toISOString()).toBe("2026-11-03T05:00:00.000Z");
      expect(result.quantity).toBe(2);
    });

    it("uses default check-in/out times when omitted", () => {
      const rentalNoTimes: RentalDetails = {
        rateUnit: "NIGHT",
        minUnits: 1,
        resourceTypeKeys: ["ROOM"],
      };
      const requested = new Date("2026-11-01T09:00:00.000Z");
      const result = computeRentalTime({
        startsAt: requested,
        quantity: 1,
        rental: rentalNoTimes,
        timeZone: dhakaZone,
      });

      // Default 14:00 check-in, 11:00 check-out
      expect(result.startsAt.toISOString()).toBe("2026-11-01T08:00:00.000Z");
      expect(result.endsAt.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    });
  });

  describe("validation and caps", () => {
    const rental: RentalDetails = {
      rateUnit: "DAY",
      minUnits: 2,
      maxUnits: 7,
      resourceTypeKeys: ["VEHICLE"],
    };

    it("rejects units below minUnits with BOOKING_RENTAL_UNITS_OUT_OF_RANGE", () => {
      expect(() =>
        computeRentalTime({
          startsAt: new Date("2026-11-01T04:00:00.000Z"),
          quantity: 1,
          rental,
          timeZone: dhakaZone,
        }),
      ).toThrowError(
        expect.objectContaining({
          details: { ruleKey: BOOKING_RULE_KEY.BOOKING_RENTAL_UNITS_OUT_OF_RANGE },
        }),
      );
    });

    it("rejects units above maxUnits with BOOKING_RENTAL_UNITS_OUT_OF_RANGE", () => {
      expect(() =>
        computeRentalTime({
          startsAt: new Date("2026-11-01T04:00:00.000Z"),
          quantity: 8,
          rental,
          timeZone: dhakaZone,
        }),
      ).toThrowError(
        expect.objectContaining({
          details: { ruleKey: BOOKING_RULE_KEY.BOOKING_RENTAL_UNITS_OUT_OF_RANGE },
        }),
      );
    });

    it("rejects durations exceeding 31 days with BOOKING_RENTAL_DURATION_EXCEEDED", () => {
      const openRental: RentalDetails = {
        rateUnit: "DAY",
        minUnits: 1,
        resourceTypeKeys: ["ROOM"],
      };
      expect(() =>
        computeRentalTime({
          startsAt: new Date("2026-11-01T04:00:00.000Z"),
          quantity: 32,
          rental: openRental,
          timeZone: dhakaZone,
        }),
      ).toThrowError(
        expect.objectContaining({
          details: { ruleKey: BOOKING_RULE_KEY.BOOKING_RENTAL_DURATION_EXCEEDED },
        }),
      );
    });

    it("allows a 31-day rental exactly", () => {
      const openRental: RentalDetails = {
        rateUnit: "DAY",
        minUnits: 1,
        resourceTypeKeys: ["ROOM"],
      };
      const result = computeRentalTime({
        startsAt: new Date("2026-11-01T04:00:00.000Z"),
        quantity: 31,
        rental: openRental,
        timeZone: dhakaZone,
      });
      expect(result.quantity).toBe(31);
    });
  });
});
