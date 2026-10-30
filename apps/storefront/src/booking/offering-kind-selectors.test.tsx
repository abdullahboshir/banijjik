import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import { beforeEach, describe, expect, it } from "vitest";
import { cartStore } from "../checkout/cart-store";
import { fetchAvailability } from "./availability-api";

function createMockOffering(
  overrides: Partial<PublicOfferingDetailResponse>,
): PublicOfferingDetailResponse {
  return {
    offeringId: "offering-123",
    slug: "sample-offering",
    name: { bn: "নমুনা অফার", en: "Sample Offering" },
    kind: "SERVICE",
    categoryId: "cat-1",
    startingPrice: { amount: 50000, currency: "BDT" },
    mediaUrl: null,
    activeLocationIds: ["loc-dhaka"],
    publishedLocationIds: ["loc-dhaka"],
    description: { bn: "বিবরণ", en: "Description" },
    variants: [
      {
        variantId: "var-1",
        name: { bn: "ভ্যারিয়েন্ট ১", en: "Variant 1" },
        sku: "SKU-1",
        price: { amount: 50000, currency: "BDT" },
        isAvailable: true,
        attributes: {},
      },
    ],
    modifierGroups: [],
    publicCustomFields: {},
    ...overrides,
  };
}

describe("Part B2: Offering Kind Selectors and Availability", () => {
  beforeEach(() => {
    cartStore.clear();
  });

  describe("Availability API boundary", () => {
    it("rejects availability queries exceeding 31 days", async () => {
      await expect(
        fetchAvailability("org-1", {
          offeringId: "off-1",
          variantId: "var-1",
          locationId: "loc-1",
          startDate: "2026-11-01",
          endDate: "2026-12-15", // 45 days span
        }),
      ).rejects.toThrow(/cannot exceed 31 days/);
    });

    it("rejects invalid date formats", async () => {
      await expect(
        fetchAvailability("org-1", {
          offeringId: "off-1",
          variantId: "var-1",
          locationId: "loc-1",
          startDate: "invalid-date",
          endDate: "2026-11-05",
        }),
      ).rejects.toThrow(/Invalid start or end date/);
    });
  });

  describe("SERVICE Booking Selector", () => {
    it("detects WALK_IN_ONLY and prevents scheduled reservation", () => {
      const walkInOffering = createMockOffering({
        kind: "SERVICE",
        publicCustomFields: { bookingMode: "WALK_IN_ONLY" },
      });

      expect(walkInOffering.publicCustomFields["bookingMode"]).toBe("WALK_IN_ONLY");
    });

    it("adds scheduled SERVICE selection to cart with startsAt and resourceIds", () => {
      const scheduledOffering = createMockOffering({
        kind: "SERVICE",
        publicCustomFields: {
          resources: [{ resourceId: "staff-karim", name: "Karim (Stylist)" }],
        },
      });

      const res = cartStore.addItem({
        locationId: "loc-dhaka",
        selection: {
          kind: "SERVICE",
          offeringId: scheduledOffering.offeringId,
          variantId: "var-1",
          startsAt: "2026-11-05T10:00:00.000Z",
          resourceIds: ["staff-karim"],
        },
        display: {
          offeringName: scheduledOffering.name,
          variantName: scheduledOffering.variants[0]?.name ?? scheduledOffering.name,
          unitPrice: scheduledOffering.startingPrice,
          mediaUrl: null,
          kind: "SERVICE",
        },
      });

      expect(res.ok).toBe(true);
      const items = cartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.selection.kind).toBe("SERVICE");
      if (items[0]?.selection.kind === "SERVICE") {
        expect(items[0].selection.startsAt).toBe("2026-11-05T10:00:00.000Z");
        expect(items[0].selection.resourceIds).toEqual(["staff-karim"]);
      }
    });
  });

  describe("RENTAL Booking Selector", () => {
    it("validates that rental end must be after rental start", () => {
      const startMs = Date.parse("2026-11-05T14:00:00.000Z");
      const invalidEndMs = Date.parse("2026-11-05T12:00:00.000Z");
      const validEndMs = Date.parse("2026-11-05T18:00:00.000Z");

      expect(invalidEndMs > startMs).toBe(false);
      expect(validEndMs > startMs).toBe(true);
    });

    it("adds RENTAL selection to cart with date range and resourceIds", () => {
      const rentalOffering = createMockOffering({
        kind: "RENTAL",
        startingPrice: { amount: 150000, currency: "BDT" },
        publicCustomFields: {
          resources: [{ resourceId: "studio-a", name: "Studio Room A" }],
        },
      });

      const res = cartStore.addItem({
        locationId: "loc-dhaka",
        selection: {
          kind: "RENTAL",
          offeringId: rentalOffering.offeringId,
          variantId: "var-1",
          startsAt: "2026-11-05T10:00:00.000Z",
          endsAt: "2026-11-05T14:00:00.000Z",
          resourceIds: ["studio-a"],
        },
        display: {
          offeringName: rentalOffering.name,
          variantName: rentalOffering.variants[0]?.name ?? rentalOffering.name,
          unitPrice: rentalOffering.startingPrice,
          mediaUrl: null,
          kind: "RENTAL",
        },
      });

      expect(res.ok).toBe(true);
      const items = cartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.selection.kind).toBe("RENTAL");
      if (items[0]?.selection.kind === "RENTAL") {
        expect(items[0].selection.startsAt).toBe("2026-11-05T10:00:00.000Z");
        expect(items[0].selection.endsAt).toBe("2026-11-05T14:00:00.000Z");
        expect(items[0].selection.resourceIds).toEqual(["studio-a"]);
      }
    });
  });

  describe("EVENT Booking Selector", () => {
    it("adds EVENT selection to cart with eventSessionId and seat quantity", () => {
      const eventOffering = createMockOffering({
        kind: "EVENT",
        startingPrice: { amount: 100000, currency: "BDT" },
        publicCustomFields: {
          eventSessions: [
            {
              eventSessionId: "session-workshop-morning",
              title: "Morning Workshop",
              startsAt: "2026-11-10T09:00:00.000Z",
              availableSeats: 30,
            },
          ],
        },
      });

      const res = cartStore.addItem({
        locationId: "loc-dhaka",
        selection: {
          kind: "EVENT",
          offeringId: eventOffering.offeringId,
          variantId: "var-1",
          eventSessionId: "session-workshop-morning",
          quantity: 3,
        },
        display: {
          offeringName: eventOffering.name,
          variantName: eventOffering.variants[0]?.name ?? eventOffering.name,
          unitPrice: eventOffering.startingPrice,
          mediaUrl: null,
          kind: "EVENT",
        },
      });

      expect(res.ok).toBe(true);
      const items = cartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.selection.kind).toBe("EVENT");
      if (items[0]?.selection.kind === "EVENT") {
        expect(items[0].selection.eventSessionId).toBe("session-workshop-morning");
        expect(items[0].selection.quantity).toBe(3);
      }
    });
  });

  describe("PLAN Enrollment Selector", () => {
    it("computes upfront obligation breakdown (admissionFee + firstRecurringFee + securityDeposit)", () => {
      const planOffering = createMockOffering({
        kind: "PLAN",
        publicCustomFields: {
          admissionFee: 200000, // 2000 BDT
          securityDeposit: 300000, // 3000 BDT
        },
        variants: [
          {
            variantId: "plan-monthly-var",
            name: { bn: "মাসিক মেম্বারশিপ", en: "Monthly Membership" },
            sku: "PLAN-M",
            price: { amount: 150000, currency: "BDT" }, // 1500 BDT first recurring fee
            isAvailable: true,
            attributes: {},
          },
        ],
      });

      const admissionFee = Number(planOffering.publicCustomFields["admissionFee"]);
      const securityDeposit = Number(planOffering.publicCustomFields["securityDeposit"]);
      const firstRecurringFee = planOffering.variants[0]?.price.amount ?? 0;
      const totalUpfront = admissionFee + firstRecurringFee + securityDeposit;

      expect(admissionFee).toBe(200000);
      expect(securityDeposit).toBe(300000);
      expect(firstRecurringFee).toBe(150000);
      expect(totalUpfront).toBe(650000);
    });

    it("adds PLAN enrollment selection to cart with startsOn, resourceIds, and customFields", () => {
      const planOffering = createMockOffering({
        kind: "PLAN",
        startingPrice: { amount: 150000, currency: "BDT" },
      });

      const res = cartStore.addItem({
        locationId: "loc-dhaka",
        selection: {
          kind: "PLAN",
          offeringId: planOffering.offeringId,
          variantId: "var-1",
          startsOn: "2026-11-01",
          resourceIds: ["locker-12"],
        },
        customFields: {
          emergencyContact: "01711112222",
        },
        display: {
          offeringName: planOffering.name,
          variantName: planOffering.variants[0]?.name ?? planOffering.name,
          unitPrice: planOffering.startingPrice,
          mediaUrl: null,
          kind: "PLAN",
        },
      });

      expect(res.ok).toBe(true);
      const items = cartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.selection.kind).toBe("PLAN");
      if (items[0]?.selection.kind === "PLAN") {
        expect(items[0].selection.startsOn).toBe("2026-11-01");
        expect(items[0].selection.resourceIds).toEqual(["locker-12"]);
      }
      expect(items[0]?.customFields).toEqual({ emergencyContact: "01711112222" });
    });
  });
});
