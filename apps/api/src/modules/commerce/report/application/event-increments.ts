import { EVENT_TYPE, type EventType } from "@banijjik/contracts";
import type { ReportCounter, ReportMethodCounter } from "@banijjik/contracts/report";
import { businessDateOf } from "../domain/business-date.js";
import { reportCurrencyMismatch, reportSourceMissing } from "../domain/errors.js";
import type { MethodDelta, SummaryIncrement } from "../domain/summary-increment.js";
import type { ReportSourceReader } from "./ports/report-ports.js";

/** What one handled event adds to the daily row it belongs to (plan 3.10 decision 4). */
export interface IncrementContext {
  readonly subjectId: string;
  readonly occurredAt: Date;
  readonly timeZone: string;
  readonly organizationCurrency: string;
  readonly reader: ReportSourceReader;
}

type IncrementBuilder = (context: IncrementContext) => Promise<SummaryIncrement>;
type CounterDeltas = Readonly<Partial<Record<ReportCounter, number>>>;
type PaymentDirection = "IN" | "REFUND" | "REVERSAL";

/** The payload field that names the fact each event counts. Enrollment check-ins name their enrollment. */
export const REPORT_SUBJECT_KEY: Readonly<Record<string, string>> = {
  [EVENT_TYPE.ORDER_COMPLETED]: "orderId",
  [EVENT_TYPE.ORDER_CANCELLED]: "orderId",
  [EVENT_TYPE.SALES_RETURN_CREATED]: "salesReturnId",
  [EVENT_TYPE.SALES_RETURN_REVERSED]: "salesReturnId",
  [EVENT_TYPE.BOOKING_COMPLETED]: "bookingId",
  [EVENT_TYPE.BOOKING_CANCELLED]: "bookingId",
  [EVENT_TYPE.BOOKING_NO_SHOW_MARKED]: "bookingId",
  [EVENT_TYPE.ENROLLMENT_CREATED]: "enrollmentId",
  [EVENT_TYPE.ENROLLMENT_ACTIVATED]: "enrollmentId",
  [EVENT_TYPE.ENROLLMENT_CANCELLED]: "enrollmentId",
  [EVENT_TYPE.ENROLLMENT_RENEWED]: "enrollmentId",
  [EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED]: "enrollmentId",
  [EVENT_TYPE.PAYMENT_RECEIVED]: "paymentId",
  [EVENT_TYPE.PAYMENT_REFUNDED]: "paymentId",
  [EVENT_TYPE.PAYMENT_REVERSED]: "paymentId",
  [EVENT_TYPE.EXPENSE_POSTED]: "expenseId",
  [EVENT_TYPE.EXPENSE_VOIDED]: "expenseId",
};

function assertSameCurrency(currency: string, organizationCurrency: string): void {
  if (currency !== organizationCurrency) throw reportCurrencyMismatch();
}

function countedOn(
  locationId: string,
  businessDate: string,
  counterDeltas: CounterDeltas,
): SummaryIncrement {
  return { locationId, businessDate, counterDeltas };
}

/** The organization-local day of the event's own instant (the event time, decision 4). */
function eventDateOf(context: IncrementContext): string {
  return businessDateOf(context.occurredAt, context.timeZone);
}

async function requireOrder(context: IncrementContext) {
  const order = await context.reader.readOrderFacts(context.subjectId);
  if (order === undefined) throw reportSourceMissing(`order:${context.subjectId}`);
  assertSameCurrency(order.currency, context.organizationCurrency);
  return order;
}

const orderCompleted: IncrementBuilder = async (context) => {
  const order = await requireOrder(context);
  // The order's own completion instant, never the UTC date: a missing one is a bug in the source reader.
  if (order.completedAt === null) {
    throw reportSourceMissing(`order.completedAt:${context.subjectId}`);
  }
  return countedOn(order.locationId, businessDateOf(order.completedAt, context.timeZone), {
    ordersCompleted: 1,
    grossSales: order.subtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    deliveryCharges: order.deliveryCharge,
    netSales: order.grandTotal,
  });
};

const orderCancelled: IncrementBuilder = async (context) => {
  const order = await requireOrder(context);
  return countedOn(order.locationId, eventDateOf(context), { ordersCancelled: 1 });
};

async function requireSalesReturn(context: IncrementContext) {
  const salesReturn = await context.reader.readSalesReturnFacts(context.subjectId);
  if (salesReturn === undefined) throw reportSourceMissing(`sales-return:${context.subjectId}`);
  assertSameCurrency(salesReturn.currency, context.organizationCurrency);
  return salesReturn;
}

const salesReturnCreated: IncrementBuilder = async (context) => {
  const salesReturn = await requireSalesReturn(context);
  return countedOn(salesReturn.locationId, salesReturn.businessDate, {
    returnsCount: 1,
    returnsValue: salesReturn.value,
  });
};

/** A reversal counts on the reversal's own date, so a day that had the return keeps it. */
const salesReturnReversed: IncrementBuilder = async (context) => {
  const salesReturn = await requireSalesReturn(context);
  if (salesReturn.reversedBusinessDate === null) {
    throw reportSourceMissing(`sales-return.reversal:${context.subjectId}`);
  }
  return countedOn(salesReturn.locationId, salesReturn.reversedBusinessDate, {
    returnsReversedValue: salesReturn.value,
  });
};

async function requireBooking(context: IncrementContext) {
  const booking = await context.reader.readBookingFacts(context.subjectId);
  if (booking === undefined) throw reportSourceMissing(`booking:${context.subjectId}`);
  assertSameCurrency(booking.currency, context.organizationCurrency);
  return booking;
}

const bookingCompleted: IncrementBuilder = async (context) => {
  const booking = await requireBooking(context);
  return countedOn(booking.locationId, eventDateOf(context), {
    bookingsCompleted: 1,
    bookingsCompletedValue: booking.total,
  });
};

function bookingCounter(counter: "bookingsCancelled" | "bookingsNoShow"): IncrementBuilder {
  return async (context) => {
    const booking = await requireBooking(context);
    return countedOn(booking.locationId, eventDateOf(context), { [counter]: 1 });
  };
}

/** The enrollment's location, read from the enrollment (plan 3.10 decision 4). */
async function enrollmentLocationOf(context: IncrementContext): Promise<string> {
  const locationId = await context.reader.readEnrollmentLocationId(context.subjectId);
  if (locationId === undefined) throw reportSourceMissing(`enrollment:${context.subjectId}`);
  return locationId;
}

function enrollmentCounter(counter: ReportCounter): IncrementBuilder {
  return async (context) => {
    const locationId = await enrollmentLocationOf(context);
    return countedOn(locationId, eventDateOf(context), { [counter]: 1 });
  };
}

async function requirePayment(context: IncrementContext) {
  const payment = await context.reader.readPaymentFacts(context.subjectId);
  if (payment === undefined) throw reportSourceMissing(`payment:${context.subjectId}`);
  assertSameCurrency(payment.currency, context.organizationCurrency);
  if (payment.locationId === null) {
    throw reportSourceMissing(`payment.location:${context.subjectId}`);
  }
  return { ...payment, locationId: payment.locationId };
}

/**
 * A payment event counts the direction it names: a refund in refunded, a reversal in reversed, on
 * the payment's own business date. An event whose payment has another direction is refused.
 */
function paymentCounter(
  expectedDirection: PaymentDirection,
  field: ReportMethodCounter,
): IncrementBuilder {
  return async (context) => {
    const payment = await requirePayment(context);
    if (payment.direction !== expectedDirection) {
      throw reportSourceMissing(`payment.direction:${context.subjectId}`);
    }
    const methodDelta: MethodDelta = { field, method: payment.method, amount: payment.amount };
    return { ...countedOn(payment.locationId, payment.businessDate, {}), methodDelta };
  };
}

async function requireExpense(context: IncrementContext) {
  const expense = await context.reader.readExpenseFacts(context.subjectId);
  if (expense === undefined) throw reportSourceMissing(`expense:${context.subjectId}`);
  assertSameCurrency(expense.currency, context.organizationCurrency);
  return expense;
}

const expensePosted: IncrementBuilder = async (context) => {
  const expense = await requireExpense(context);
  return countedOn(expense.locationId, expense.businessDate, { expensesTotal: expense.amount });
};

/** A void subtracts on the void's own date, so the posted day keeps its value (plan 3.10 decision 4). */
const expenseVoided: IncrementBuilder = async (context) => {
  const expense = await requireExpense(context);
  return countedOn(expense.locationId, eventDateOf(context), { expensesTotal: -expense.amount });
};

const BUILDERS: Readonly<Partial<Record<EventType, IncrementBuilder>>> = {
  [EVENT_TYPE.ORDER_COMPLETED]: orderCompleted,
  [EVENT_TYPE.ORDER_CANCELLED]: orderCancelled,
  [EVENT_TYPE.SALES_RETURN_CREATED]: salesReturnCreated,
  [EVENT_TYPE.SALES_RETURN_REVERSED]: salesReturnReversed,
  [EVENT_TYPE.BOOKING_COMPLETED]: bookingCompleted,
  [EVENT_TYPE.BOOKING_CANCELLED]: bookingCounter("bookingsCancelled"),
  [EVENT_TYPE.BOOKING_NO_SHOW_MARKED]: bookingCounter("bookingsNoShow"),
  [EVENT_TYPE.ENROLLMENT_CREATED]: enrollmentCounter("enrollmentsCreated"),
  [EVENT_TYPE.ENROLLMENT_ACTIVATED]: enrollmentCounter("enrollmentsActivated"),
  [EVENT_TYPE.ENROLLMENT_CANCELLED]: enrollmentCounter("enrollmentsCancelled"),
  [EVENT_TYPE.ENROLLMENT_RENEWED]: enrollmentCounter("enrollmentsRenewed"),
  [EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED]: enrollmentCounter("checkIns"),
  [EVENT_TYPE.PAYMENT_RECEIVED]: paymentCounter("IN", "paidInByMethod"),
  [EVENT_TYPE.PAYMENT_REFUNDED]: paymentCounter("REFUND", "refundedByMethod"),
  [EVENT_TYPE.PAYMENT_REVERSED]: paymentCounter("REVERSAL", "reversedByMethod"),
  [EVENT_TYPE.EXPENSE_POSTED]: expensePosted,
  [EVENT_TYPE.EXPENSE_VOIDED]: expenseVoided,
};

/** Every event type the summarize handler consumes: exactly the keys of the builder table. */
export const REPORT_HANDLED_EVENT_TYPES: readonly EventType[] = Object.keys(
  BUILDERS,
) as EventType[];

/** The increment of one event, or undefined for a type this report does not count. */
export function incrementOf(
  eventType: EventType,
  context: IncrementContext,
): Promise<SummaryIncrement> | undefined {
  return BUILDERS[eventType]?.(context);
}
