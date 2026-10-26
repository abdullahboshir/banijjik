import { defineEnum } from "../define-enum.js";

/** The home and reports read at most this many organization-local days in one request (plan 3.10 decision 7). */
export const REPORT_DAILY_MAX_DAYS = 92;
/** A month-to-date read sums at most this many daily rows per location (plan 3.10 decision 7). */
export const REPORT_MONTH_MAX_DAYS = 31;

/** The home sections. Each one is shown only while its source module is effective (plan 3.10 decision 8). */
export const REPORT_SECTION = defineEnum(["SALES", "BOOKINGS", "ENROLLMENTS", "MONEY"]);
export type ReportSection = (typeof REPORT_SECTION)[keyof typeof REPORT_SECTION];

/** Integer counters of one daily summary row. Money fields are minor units of the organization currency. */
export const REPORT_COUNTER = defineEnum([
  "ordersCompleted",
  "grossSales",
  "discountTotal",
  "taxTotal",
  "deliveryCharges",
  "netSales",
  "ordersCancelled",
  "returnsCount",
  "returnsValue",
  "returnsReversedValue",
  "bookingsCompleted",
  "bookingsCompletedValue",
  "bookingsCancelled",
  "bookingsNoShow",
  "enrollmentsCreated",
  "enrollmentsActivated",
  "enrollmentsCancelled",
  "enrollmentsRenewed",
  "checkIns",
  "expensesTotal",
]);
export type ReportCounter = (typeof REPORT_COUNTER)[keyof typeof REPORT_COUNTER];

/** Counters keyed by payment method: money in, refunds out and reversals. */
export const REPORT_METHOD_COUNTER = defineEnum([
  "paidInByMethod",
  "refundedByMethod",
  "reversedByMethod",
]);
export type ReportMethodCounter =
  (typeof REPORT_METHOD_COUNTER)[keyof typeof REPORT_METHOD_COUNTER];

/** Values computed at read time and never stored (plan 3.10 decision 2). */
export interface ReportDerivedValues {
  /** netSales - returnsValue + returnsReversedValue. */
  readonly netSalesAfterReturns: number;
  /** floor(netSales / ordersCompleted), 0 when there are no orders. */
  readonly averageOrderValue: number;
  /** Sum of money in minus refunds minus reversals. */
  readonly moneyInNet: number;
}

export type ReportCounters = Readonly<Record<ReportCounter, number>>;
export type ReportMethodTotals = Readonly<Record<string, number>>;

/** One period (a day, the month to date, or a range) as the API returns it. */
export interface ReportPeriodValues {
  readonly counters: ReportCounters;
  readonly paidInByMethod: ReportMethodTotals;
  readonly refundedByMethod: ReportMethodTotals;
  readonly reversedByMethod: ReportMethodTotals;
  readonly derived: ReportDerivedValues;
}

export interface ReportHomePeriods {
  readonly today: ReportPeriodValues;
  readonly yesterday: ReportPeriodValues;
  readonly monthToDate: ReportPeriodValues;
}

/** The home: only the sections whose modules are effective appear in `sections`. */
export interface ReportHomeResponse {
  readonly businessDate: string;
  readonly yesterdayDate: string;
  readonly currency: string;
  readonly sections: readonly ReportSection[];
  readonly periods: ReportHomePeriods;
}

export interface ReportDayRow {
  readonly businessDate: string;
  readonly values: ReportPeriodValues;
}

export interface ReportDailyResponse {
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  readonly items: readonly ReportDayRow[];
  readonly totals: ReportPeriodValues;
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}
