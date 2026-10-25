import type { ReportCounters, ReportMethodTotals } from "@banijjik/contracts/report";
import type { SummaryIncrement } from "../../domain/summary-increment.js";

/** An order's figures, read through the sales module's index (plan 3.10 decision 5). */
export interface OrderFact {
  readonly locationId: string;
  readonly currency: string;
  readonly completedAt: Date | null;
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly taxTotal: number;
  readonly deliveryCharge: number;
  readonly grandTotal: number;
}

/** A return's figures. `reversedBusinessDate` is set once the return was reversed (3.5b A2). */
export interface SalesReturnFact {
  readonly locationId: string;
  readonly currency: string;
  readonly businessDate: string;
  readonly value: number;
  readonly reversedBusinessDate: string | null;
}

export interface BookingFact {
  readonly locationId: string;
  readonly currency: string;
  readonly total: number;
}

export interface PaymentFact {
  readonly locationId: string | null;
  readonly currency: string;
  readonly businessDate: string;
  readonly amount: number;
  readonly method: string;
  readonly direction: "IN" | "REFUND" | "REVERSAL";
}

export interface ExpenseFact {
  readonly locationId: string;
  readonly currency: string;
  readonly businessDate: string;
  readonly amount: number;
}

/** Reads what the report needs from the source modules. Each method answers undefined for an unknown id. */
export interface ReportSourceReader {
  readOrderFacts(orderId: string): Promise<OrderFact | undefined>;
  readSalesReturnFacts(salesReturnId: string): Promise<SalesReturnFact | undefined>;
  readBookingFacts(bookingId: string): Promise<BookingFact | undefined>;
  readEnrollmentLocationId(enrollmentId: string): Promise<string | undefined>;
  readPaymentFacts(paymentId: string): Promise<PaymentFact | undefined>;
  readExpenseFacts(expenseId: string): Promise<ExpenseFact | undefined>;
}

export interface OrganizationLocalSettings {
  timeZoneOf(organizationId: string): Promise<string | undefined>;
  currencyOf(organizationId: string): Promise<string | undefined>;
}

/** Records that an event was counted. `true` only the first time the pair is seen. */
export interface ReportEventMarkerRepository {
  recordIfNew(input: {
    readonly organizationId: string;
    readonly eventId: string;
    readonly appliedAt: Date;
  }): Promise<boolean>;
}

export interface DailySummaryWriter {
  applyIncrement(input: {
    readonly organizationId: string;
    readonly currency: string;
    readonly increment: SummaryIncrement;
  }): Promise<void>;
}

/** One stored daily row, as the home and reports read it (lean, projected). */
export interface DailySummaryRow {
  readonly locationId: string;
  readonly businessDate: string;
  readonly counters: ReportCounters;
  readonly paidInByMethod: ReportMethodTotals;
  readonly refundedByMethod: ReportMethodTotals;
  readonly reversedByMethod: ReportMethodTotals;
}

export interface DailySummaryReader {
  /** Rows of the given days, of every location or of one. Keyed by the compound index. */
  listRows(input: {
    readonly organizationId: string;
    readonly businessDates: readonly string[];
    readonly locationId?: string | undefined;
  }): Promise<readonly DailySummaryRow[]>;
}
