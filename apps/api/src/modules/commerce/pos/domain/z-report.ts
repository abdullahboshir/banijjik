import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  type Money,
  type PaymentDirection,
} from "@banijjik/contracts/payment";
import type { PosMethodTotal, PosZReport } from "@banijjik/contracts/pos";
import type { MemberId } from "@banijjik/ids";
import type { PosSession } from "./pos-session.entity.js";
import type { SessionMethodTotal, SessionOrderAllocation } from "./session-payment-totals.js";

/** The money totals of one order the register sold. */
export interface SoldOrderTotals {
  readonly orderId: string;
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly taxMinor: number;
  readonly grandTotalMinor: number;
}

export interface ZReportInput {
  readonly session: PosSession;
  readonly zReportNumber: string;
  readonly closedAt: Date;
  readonly closedByMemberId: MemberId;
  readonly methodTotals: readonly SessionMethodTotal[];
  readonly orderAllocations: readonly SessionOrderAllocation[];
  readonly soldOrders: readonly SoldOrderTotals[];
  readonly expectedCash: Money;
  readonly countedCash: Money;
}

function methodTotalsOf(
  rows: readonly SessionMethodTotal[],
  direction: PaymentDirection,
  skipStoreCredit: boolean,
): readonly PosMethodTotal[] {
  const methodOrder = Object.values(PAYMENT_METHOD);
  return rows
    .filter((row) => row.direction === direction)
    .filter((row) => !(skipStoreCredit && row.method === PAYMENT_METHOD.STORE_CREDIT))
    .map((row) => ({
      method: row.method,
      total: { amount: row.totalMinor, currency: row.currency as Money["currency"] },
      count: row.count,
    }))
    .sort((left, right) => methodOrder.indexOf(left.method) - methodOrder.indexOf(right.method));
}

function storeCreditUsedMinor(rows: readonly SessionMethodTotal[]): number {
  return rows
    .filter((row) => row.direction === PAYMENT_DIRECTION.IN)
    .filter((row) => row.method === PAYMENT_METHOD.STORE_CREDIT)
    .reduce((sum, row) => sum + row.totalMinor, 0);
}

/** What stayed owed: for each sold order, the grand total less what this register's payments covered. */
function duesCreatedMinor(
  soldOrders: readonly SoldOrderTotals[],
  allocations: readonly SessionOrderAllocation[],
): number {
  const allocatedByOrder = new Map(allocations.map((row) => [row.orderId, row.allocatedMinor]));
  return soldOrders.reduce(
    (sum, order) =>
      sum + Math.max(0, order.grandTotalMinor - (allocatedByOrder.get(order.orderId) ?? 0)),
    0,
  );
}

function sumOf(
  orders: readonly SoldOrderTotals[],
  pick: (order: SoldOrderTotals) => number,
): number {
  return orders.reduce((sum, order) => sum + pick(order), 0);
}

/** The numbered Z-report frozen on the session at close (plan 3.9 decision 7). Pure: no reads. */
export function buildZReport(input: ZReportInput): PosZReport {
  const { session, soldOrders } = input;
  const { currency } = session.openingFloat;
  const money = (amount: number): Money => ({ amount, currency });
  return {
    zReportNumber: input.zReportNumber,
    posSessionId: session.posSessionId,
    posDeviceId: session.posDeviceId,
    locationId: session.locationId,
    openedByMemberId: session.openedByMemberId,
    openedAt: session.openedAt.toISOString(),
    closedByMemberId: input.closedByMemberId,
    closedAt: input.closedAt.toISOString(),
    salesCount: soldOrders.length,
    gross: money(sumOf(soldOrders, (order) => order.subtotalMinor)),
    discount: money(sumOf(soldOrders, (order) => order.discountMinor)),
    tax: money(sumOf(soldOrders, (order) => order.taxMinor)),
    grandTotal: money(sumOf(soldOrders, (order) => order.grandTotalMinor)),
    paymentsIn: methodTotalsOf(input.methodTotals, PAYMENT_DIRECTION.IN, true),
    refunds: methodTotalsOf(input.methodTotals, PAYMENT_DIRECTION.REFUND, false),
    storeCreditUsed: money(storeCreditUsedMinor(input.methodTotals)),
    duesCreated: money(duesCreatedMinor(soldOrders, input.orderAllocations)),
    openingFloat: session.openingFloat,
    expectedCash: input.expectedCash,
    countedCash: input.countedCash,
    variance: money(input.countedCash.amount - input.expectedCash.amount),
  };
}
