import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { describe, expect, it } from "vitest";
import { assertTransitionAllowed, statusHoldsCapacity, targetStatusFor } from "./transitions.js";

describe("booking transitions", () => {
  it("allows confirm from REQUESTED only", () => {
    expect(() => assertTransitionAllowed(BOOKING_STATUS.REQUESTED, "confirm")).not.toThrow();
    expect(() => assertTransitionAllowed(BOOKING_STATUS.CONFIRMED, "confirm")).toThrow();
  });

  it("refuses check-in unless CONFIRMED", () => {
    expect(() => assertTransitionAllowed(BOOKING_STATUS.CONFIRMED, "checkIn")).not.toThrow();
    expect(() => assertTransitionAllowed(BOOKING_STATUS.REQUESTED, "checkIn")).toThrow();
  });

  it("maps actions to target statuses", () => {
    expect(targetStatusFor("cancel")).toBe(BOOKING_STATUS.CANCELLED);
    expect(targetStatusFor("noShow")).toBe(BOOKING_STATUS.NO_SHOW);
    expect(targetStatusFor("expire")).toBe(BOOKING_STATUS.EXPIRED);
  });

  it("counts capacity for active pipeline statuses only", () => {
    expect(statusHoldsCapacity(BOOKING_STATUS.HELD)).toBe(true);
    expect(statusHoldsCapacity(BOOKING_STATUS.CONFIRMED)).toBe(true);
    expect(statusHoldsCapacity(BOOKING_STATUS.COMPLETED)).toBe(false);
    expect(statusHoldsCapacity(BOOKING_STATUS.CANCELLED)).toBe(false);
  });
});
