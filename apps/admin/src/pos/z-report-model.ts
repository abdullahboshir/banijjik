import type { Money, PaymentMethod } from "@banijjik/contracts/payment";
import type { PosMethodTotal, PosZReport } from "@banijjik/contracts/pos";

export interface ZReportMethodRow {
  readonly method: PaymentMethod;
  readonly count: number;
  readonly total: Money;
}

export interface ZReportGroup {
  readonly rows: readonly ZReportMethodRow[];
}

/** The Z-report as printed: every number is the server's, only the order and grouping are the till's. */
export interface ZReportModel {
  readonly zReportNumber: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly salesCount: number;
  readonly salesGross: Money;
  readonly salesDiscount: Money;
  readonly salesTax: Money;
  readonly salesGrandTotal: Money;
  readonly receivedByMethod: ZReportGroup;
  readonly collectedByMethod: ZReportGroup;
  readonly refundedByMethod: ZReportGroup;
  readonly returnsCount: number;
  readonly returnsValue: Money;
  readonly returnsRefundedByMethod: ZReportGroup;
  readonly storeCreditUsed: Money;
  readonly duesCreated: Money;
  readonly openingFloat: Money;
  readonly expectedCash: Money;
  readonly countedCash: Money;
  readonly variance: Money;
}

function methodRowsOf(totals: readonly PosMethodTotal[]): ZReportGroup {
  return {
    rows: totals.map((total) => ({
      method: total.method,
      count: total.count,
      total: total.total,
    })),
  };
}

/** Keeps the server's order and amounts for the printed Z-report. Nothing is recomputed here. */
export function buildZReportModel(report: PosZReport): ZReportModel {
  return {
    zReportNumber: report.zReportNumber,
    openedAt: report.openedAt,
    closedAt: report.closedAt,
    salesCount: report.salesCount,
    salesGross: report.gross,
    salesDiscount: report.discount,
    salesTax: report.tax,
    salesGrandTotal: report.grandTotal,
    receivedByMethod: methodRowsOf(report.paymentsIn),
    collectedByMethod: methodRowsOf(report.collections),
    refundedByMethod: methodRowsOf(report.refunds),
    returnsCount: report.returns.count,
    returnsValue: report.returns.value,
    returnsRefundedByMethod: methodRowsOf(report.returns.refunds),
    storeCreditUsed: report.storeCreditUsed,
    duesCreated: report.duesCreated,
    openingFloat: report.openingFloat,
    expectedCash: report.expectedCash,
    countedCash: report.countedCash,
    variance: report.variance,
  };
}
