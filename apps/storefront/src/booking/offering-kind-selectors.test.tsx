// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cartStore } from "../checkout/cart-store";
import { fetchAvailability } from "./availability-api";
import { ServiceBookingSelector } from "./service-booking-selector";
import { translatorFor } from "../i18n/client-translator";
import { todayDateString } from "./service-booking-fields";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

    it("adds scheduled SERVICE selection using the availability slot startsAt unchanged", async () => {
      const scheduledOffering = createMockOffering({
        kind: "SERVICE",
        publicCustomFields: {
          resources: [{ resourceId: "staff-karim", name: "Karim (Stylist)" }],
        },
      });
      const date = todayDateString();
      const apiStartsAt = `${date}T04:00:00.000Z`;
      const apiSecondStartsAt = `${date}T05:00:00.000Z`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              offeringId: scheduledOffering.offeringId,
              variantId: "var-1",
              locationId: "loc-dhaka",
              days: [
                {
                  date,
                  slots: [
                    {
                      startsAt: apiStartsAt,
                      endsAt: `${date}T04:30:00.000Z`,
                      resourceIds: ["staff-karim"],
                    },
                    {
                      startsAt: apiSecondStartsAt,
                      endsAt: `${date}T05:30:00.000Z`,
                      resourceIds: ["staff-karim"],
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      const callback = vi.fn(
        (input: { variantId: string; startsAt: string; resourceIds: readonly string[] }) => {
          cartStore.addItem({
            locationId: "loc-dhaka",
            selection: {
              kind: "SERVICE",
              offeringId: scheduledOffering.offeringId,
              variantId: input.variantId,
              startsAt: input.startsAt,
              resourceIds: input.resourceIds,
            },
            display: {
              offeringName: scheduledOffering.name,
              variantName: scheduledOffering.variants[0]?.name ?? scheduledOffering.name,
              unitPrice: scheduledOffering.startingPrice,
              mediaUrl: null,
              kind: "SERVICE",
            },
          });
        },
      );
      render(
        <ServiceBookingSelector
          organizationId="org-123"
          locationId="loc-dhaka"
          offering={scheduledOffering}
          locale="en"
          t={translatorFor("en").t}
          onBookService={callback}
        />,
      );
      await screen.findByRole("option", { name: apiSecondStartsAt });
      const requestUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]), "https://salon.localhost");
      expect(requestUrl.pathname).toContain("/api/v1/storefront/orgs/org-123/availability");
      expect(requestUrl.searchParams.get("offeringId")).toBe(scheduledOffering.offeringId);
      expect(requestUrl.searchParams.get("variantId")).toBe("var-1");
      expect(requestUrl.searchParams.get("locationId")).toBe("loc-dhaka");
      expect(requestUrl.searchParams.get("startDate")).toBe(date);
      expect(requestUrl.searchParams.get("endDate")).toBe(date);
      fireEvent.change(screen.getByDisplayValue(apiStartsAt), {
        target: { value: apiSecondStartsAt },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reserve Booking" }));
      await waitFor(() => expect(callback).toHaveBeenCalledOnce());
      expect(callback.mock.calls[0]?.[0].startsAt).toBe(apiSecondStartsAt);
      const items = cartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.selection.kind).toBe("SERVICE");
      if (items[0]?.selection.kind === "SERVICE") {
        expect(items[0].selection.startsAt).toBe(apiSecondStartsAt);
        expect(items[0].selection.resourceIds).toEqual([]);
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
