import { CURRENCY_CODE } from "@banijjik/contracts";
import type { OrderLineSnapshot } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { statusKey } from "../modules/commerce/website/index.js";
import {
  buildStorefrontRequestStatusReaderAdapter,
  projectStorefrontOrderItems,
  type StorefrontRequestStatusSources,
} from "./storefront-request-status-adapter.js";

const BDT = CURRENCY_CODE.BDT;
const ORGANIZATION_ID = "01920000-0000-7000-8000-000000000001";

describe("storefront order tracking projection", () => {
  it("returns customer-safe line data without internal seller or cost fields", () => {
    const unitPrice = { amount: 1200, currency: BDT };
    const internalLine: OrderLineSnapshot = {
      orderLineId: "line-1",
      offeringId: "offering-1",
      variantId: "variant-1",
      kind: "PRODUCT",
      nameSnapshot: "Tea",
      quantity: 2,
      unitPrice,
      listUnitPrice: { amount: 1500, currency: BDT },
      unitPriceOverride: { amount: 1000, currency: BDT },
      lineGross: { amount: 3000, currency: BDT },
      lineDiscount: { amount: 600, currency: BDT },
      lineTax: { amount: 0, currency: BDT },
      lineNetTotal: { amount: 2400, currency: BDT },
      unitCostSnapshot: { amount: 500, currency: BDT },
      modifiers: [],
      returnedQuantity: 0,
      promotionIds: ["promotion-1"],
      taxClassKey: "standard",
      manualDiscount: { type: "AMOUNT", value: 600 },
      performedByMemberId: "member-1",
    };

    expect(projectStorefrontOrderItems([internalLine])).toEqual([
      { name: "Tea", quantity: 2, unitPrice },
    ]);
  });
});

describe("storefront live request status reader", () => {
  it("makes one read per request type per batch and keys snapshots by type and id", async () => {
    const orderIdA = newId();
    const orderIdB = newId();
    const bookingId = newId();
    const enrollmentId = newId();
    const calls = { orders: 0, bookings: 0, enrollments: 0, summaries: 0 };
    const sources: StorefrontRequestStatusSources = {
      orders: {
        findByIds: async (orderIds) => {
          calls.orders += 1;
          return orderIds.map((orderId) => ({
            orderId,
            organizationId: ORGANIZATION_ID,
            orderNumber: `ORD-${orderId}`,
            status: "PLACED",
            totals: { grandTotal: { amount: 900, currency: BDT } },
            lines: [],
            fulfillment: { method: "PICKUP" as const },
            createdAt: new Date("2026-10-30T12:00:00.000Z"),
          }));
        },
      },
      bookings: {
        findByIds: async () => {
          calls.bookings += 1;
          return [];
        },
      },
      enrollments: {
        findByIds: async () => {
          calls.enrollments += 1;
          return [];
        },
      },
      summaries: {
        findByRequests: async (_organizationId, _requestType, requestIds) => {
          calls.summaries += 1;
          return requestIds.map((requestId) => ({
            requestId,
            due: { amount: 400, currency: BDT },
          }));
        },
      },
    };
    const reader = buildStorefrontRequestStatusReaderAdapter(sources);

    const statuses = await reader.readStatuses([
      { organizationId: ORGANIZATION_ID, requestType: "ORDER", requestId: orderIdA },
      { organizationId: ORGANIZATION_ID, requestType: "ORDER", requestId: orderIdB },
      { organizationId: ORGANIZATION_ID, requestType: "BOOKING", requestId: bookingId },
      { organizationId: ORGANIZATION_ID, requestType: "ENROLLMENT", requestId: enrollmentId },
    ]);

    expect(calls).toEqual({ orders: 1, bookings: 1, enrollments: 1, summaries: 2 });
    expect(statuses.get(statusKey("ORDER", orderIdA))?.paymentRequired.amount).toBe(400);
    expect(statuses.get(statusKey("ORDER", orderIdA))?.publicNumber).toBe(`ORD-${orderIdA}`);
    expect(statuses.has(statusKey("BOOKING", bookingId))).toBe(false);
    expect(statuses.has(statusKey("ENROLLMENT", enrollmentId))).toBe(false);
  });

  it("keys an enrollment payable on its current period id, not the enrollment id", async () => {
    const enrollmentId = newId();
    const periodId = newId();
    const sources: StorefrontRequestStatusSources = {
      orders: { findByIds: async () => [] },
      bookings: { findByIds: async () => [] },
      enrollments: {
        findByIds: async () => [
          {
            enrollmentId,
            organizationId: ORGANIZATION_ID,
            enrollmentNumber: "ENR-000001",
            status: "ACTIVE",
            currentEnrollmentPeriodId: periodId,
            startsOn: "2026-11-01",
            firstRecurringFee: { amount: 5000, currency: BDT },
            createdAt: new Date("2026-10-30T12:00:00.000Z"),
          },
        ],
      },
      summaries: {
        findByRequests: async (_organizationId, _requestType, requestIds) =>
          requestIds.includes(periodId)
            ? [{ requestId: periodId, due: { amount: 7500, currency: BDT } }]
            : [],
      },
    };
    const reader = buildStorefrontRequestStatusReaderAdapter(sources);

    const statuses = await reader.readStatuses([
      { organizationId: ORGANIZATION_ID, requestType: "ENROLLMENT", requestId: enrollmentId },
    ]);

    const snapshot = statuses.get(statusKey("ENROLLMENT", enrollmentId));
    expect(snapshot?.paymentRequired.amount).toBe(7500);
    expect(snapshot?.plan).toEqual({ startsOn: "2026-11-01", endsOn: null });
  });
});
