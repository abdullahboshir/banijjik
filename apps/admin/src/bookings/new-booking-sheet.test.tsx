// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { canAdvanceFrom, emptyNewBookingForm } from "./new-booking-form";

vi.mock("./booking-api", () => ({
  createBooking: vi.fn(),
  listAvailability: vi.fn().mockResolvedValue([]),
}));

describe("NewBookingSheet steps", () => {
  it("requires a slot before the contact step", () => {
    const form = emptyNewBookingForm({
      locationId: "loc",
      businessDate: "2026-10-20",
    });
    form.offeringId = "o";
    form.variantId = "v";
    expect(canAdvanceFrom("slot", form)).toBe(false);
    form.startsAt = "2026-10-20T04:00:00.000Z";
    expect(canAdvanceFrom("slot", form)).toBe(true);
  });
});
