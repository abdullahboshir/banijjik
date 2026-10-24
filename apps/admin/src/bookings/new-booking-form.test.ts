import { describe, expect, it } from "vitest";
import { buildBookingCreate, canAdvanceFrom, emptyNewBookingForm } from "./new-booking-form";

describe("new booking sheet steps", () => {
  it("requires a service before the variant step", () => {
    const form = emptyNewBookingForm({
      locationId: "loc",
      businessDate: "2026-10-20",
    });
    expect(canAdvanceFrom("service", form)).toBe(false);
    form.offeringId = "offering-1";
    expect(canAdvanceFrom("service", form)).toBe(true);
  });

  it("builds a create body with an inline contact", () => {
    const form = emptyNewBookingForm({
      locationId: "01900000-0000-7000-8000-000000000001",
      businessDate: "2026-10-20",
    });
    form.offeringId = "01900000-0000-7000-8000-000000000010";
    form.variantId = "01900000-0000-7000-8000-000000000011";
    form.startsAt = "2026-10-20T04:00:00.000Z";
    form.contact = { create: { name: "Rahim", phone: "+8801712345678" } };
    const built = buildBookingCreate(form, "01900000-0000-7000-8000-000000000001");
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.body).toMatchObject({
        contact: { create: { name: "Rahim", phone: "+8801712345678" } },
      });
    }
  });

  it("builds an event booking from a session and seat quantity", () => {
    const form = emptyNewBookingForm({ locationId: "loc", businessDate: "2026-10-20" });
    Object.assign(form, {
      offeringId: "offering-1",
      variantId: "variant-1",
      eventSessionId: "01900000-0000-7000-8000-000000000012",
      quantity: "2",
      contact: "01900000-0000-7000-8000-000000000013",
    });
    expect(canAdvanceFrom("slot", form)).toBe(true);
    const built = buildBookingCreate(form, "location-1");
    expect(built).toMatchObject({ ok: true });
    if (built.ok)
      expect(built.body).toMatchObject({ eventSessionId: form.eventSessionId, quantity: 2 });
  });

  it("rejects a non-positive rental quantity", () => {
    const form = emptyNewBookingForm({ locationId: "loc", businessDate: "2026-10-20" });
    Object.assign(form, {
      offeringId: "offering-1",
      variantId: "variant-1",
      startsAt: "2026-10-20T04:00:00.000Z",
      quantity: "0",
      contact: "01900000-0000-7000-8000-000000000013",
    });
    expect(buildBookingCreate(form, "location-1")).toMatchObject({
      ok: false,
      errors: { quantity: "positive" },
    });
  });
});
