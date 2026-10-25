import { PAYMENT_DIRECTION, PAYMENT_METHOD, type Money } from "@banijjik/contracts/payment";
import { asId, newId, type MemberId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { newPosSession } from "./pos-session.entity.js";
import type { SessionMethodTotal } from "./session-payment-totals.js";
import { buildZReport } from "./z-report.js";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

const MEMBER = asId<MemberId>(newId());

function total(
  method: SessionMethodTotal["method"],
  direction: SessionMethodTotal["direction"],
  totalMinor: number,
  count: number,
): SessionMethodTotal {
  return { method, direction, currency: "BDT", totalMinor, count };
}

describe("buildZReport", () => {
  it("shows totals per method, refunds, credit used and dues created", () => {
    const session = newPosSession({
      posSessionId: newId(),
      organizationId: newId(),
      posDeviceId: newId(),
      locationId: newId(),
      openedByMemberId: MEMBER,
      openingFloat: bdt(5_000),
      actorUserId: newId(),
      now: new Date("2026-10-25T04:00:00Z"),
    });

    const report = buildZReport({
      session,
      zReportNumber: "000007",
      closedAt: new Date("2026-10-25T12:00:00Z"),
      closedByMemberId: MEMBER,
      methodTotals: [
        total(PAYMENT_METHOD.CARD, PAYMENT_DIRECTION.IN, 3_000, 1),
        total(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.IN, 6_000, 2),
        total(PAYMENT_METHOD.STORE_CREDIT, PAYMENT_DIRECTION.IN, 500, 1),
        total(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.REFUND, 400, 1),
      ],
      orderAllocations: [
        { orderId: "order-1", allocatedMinor: 9_000, refundedMinor: 0 },
        { orderId: "order-2", allocatedMinor: 500, refundedMinor: 0 },
      ],
      soldOrders: [
        {
          orderId: "order-1",
          subtotalMinor: 9_500,
          discountMinor: 500,
          taxMinor: 0,
          grandTotalMinor: 9_000,
        },
        {
          orderId: "order-2",
          subtotalMinor: 2_000,
          discountMinor: 0,
          taxMinor: 300,
          grandTotalMinor: 2_300,
        },
      ],
      expectedCash: bdt(10_600),
      countedCash: bdt(10_500),
    });

    expect(report.paymentsIn.map((entry) => [entry.method, entry.total.amount])).toEqual([
      [PAYMENT_METHOD.CASH, 6_000],
      [PAYMENT_METHOD.CARD, 3_000],
    ]);
    expect(report.refunds.map((entry) => [entry.method, entry.total.amount])).toEqual([
      [PAYMENT_METHOD.CASH, 400],
    ]);
    expect(report).toMatchObject({
      zReportNumber: "000007",
      salesCount: 2,
      gross: bdt(11_500),
      discount: bdt(500),
      tax: bdt(300),
      grandTotal: bdt(11_300),
      storeCreditUsed: bdt(500),
      duesCreated: bdt(1_800),
      variance: bdt(-100),
    });
  });
});
