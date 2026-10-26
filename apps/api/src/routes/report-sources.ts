import { asId, type OrderId, type OrganizationId, type SalesReturnId } from "@banijjik/ids";
import type {
  BookingFact,
  ExpenseFact,
  OrderFact,
  OrganizationLocalSettings,
  PaymentFact,
  ReportSourceReader,
  SalesReturnFact,
} from "../modules/commerce/report/index.js";
import { buildBookingPostingSourceAdapter } from "../modules/commerce/booking/index.js";
import { buildEnrollmentLocationReader } from "../modules/commerce/enrollment/index.js";
import { buildExpensePostingSourceAdapter } from "../modules/commerce/expense/index.js";
import { buildPaymentPostingSourceAdapter } from "../modules/commerce/payment/index.js";
import {
  buildOrderRepository,
  buildSalesReturnRepository,
} from "../modules/commerce/sales/index.js";
import {
  buildOrganizationCurrencyReader,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
import { buildPaymentRequestReaders } from "./payment-request-readers.js";

type OrderRepository = ReturnType<typeof buildOrderRepository>;
type SalesReturnRepository = ReturnType<typeof buildSalesReturnRepository>;
type BookingSource = ReturnType<typeof buildBookingPostingSourceAdapter>;
type PaymentSource = ReturnType<typeof buildPaymentPostingSourceAdapter>;
type ExpenseSource = ReturnType<typeof buildExpensePostingSourceAdapter>;

/**
 * The report's read side (plan 3.10 decision 5): each source module answers through its index with
 * only the fields the report counts. Event handlers call these per event; no request reads a list.
 */
export function buildReportSourceReader(): ReportSourceReader {
  const enrollments = buildEnrollmentLocationReader();
  return {
    readOrderFacts: orderFactsReader(buildOrderRepository()),
    readSalesReturnFacts: salesReturnFactsReader(buildSalesReturnRepository()),
    readBookingFacts: bookingFactsReader(buildBookingPostingSourceAdapter()),
    readEnrollmentLocationId: (enrollmentId: string) => enrollments.readLocationId(enrollmentId),
    readPaymentFacts: paymentFactsReader(
      buildPaymentPostingSourceAdapter(buildPaymentRequestReaders()),
    ),
    readExpenseFacts: expenseFactsReader(buildExpensePostingSourceAdapter()),
  };
}

function orderFactsReader(orders: OrderRepository): ReportSourceReader["readOrderFacts"] {
  return async (orderId: string): Promise<OrderFact | undefined> => {
    const order = await orders.findById(asId<OrderId>(orderId));
    if (order === undefined) return undefined;
    const { totals } = order;
    return {
      locationId: order.locationId,
      currency: totals.grandTotal.currency,
      completedAt: order.completedAt,
      subtotal: totals.subtotal.amount,
      discountTotal: totals.discountTotal.amount,
      taxTotal: totals.taxTotal.amount,
      deliveryCharge: totals.deliveryCharge.amount,
      grandTotal: totals.grandTotal.amount,
    };
  };
}

function salesReturnFactsReader(
  salesReturns: SalesReturnRepository,
): ReportSourceReader["readSalesReturnFacts"] {
  return async (salesReturnId: string): Promise<SalesReturnFact | undefined> => {
    const salesReturn = await salesReturns.findById(asId<SalesReturnId>(salesReturnId));
    if (salesReturn === undefined) return undefined;
    return {
      locationId: salesReturn.locationId,
      currency: salesReturn.value.currency,
      businessDate: salesReturn.businessDate,
      value: salesReturn.value.amount,
      reversedBusinessDate: salesReturn.reversal?.businessDate ?? null,
    };
  };
}

function bookingFactsReader(bookings: BookingSource): ReportSourceReader["readBookingFacts"] {
  return async (bookingId: string): Promise<BookingFact | undefined> => {
    const booking = await bookings.readBooking(bookingId);
    if (booking === undefined || booking.locationId === null) return undefined;
    return {
      locationId: booking.locationId,
      currency: booking.revenueExcludingTax.currency,
      total: booking.revenueExcludingTax.amount + booking.tax.amount,
    };
  };
}

function paymentFactsReader(payments: PaymentSource): ReportSourceReader["readPaymentFacts"] {
  return async (paymentId: string): Promise<PaymentFact | undefined> => {
    const payment = await payments.readPayment(paymentId);
    if (payment === undefined) return undefined;
    return {
      locationId: payment.locationId,
      currency: payment.amount.currency,
      businessDate: payment.businessDate,
      amount: payment.amount.amount,
      method: payment.method,
      direction: payment.direction,
    };
  };
}

function expenseFactsReader(expenses: ExpenseSource): ReportSourceReader["readExpenseFacts"] {
  return async (expenseId: string): Promise<ExpenseFact | undefined> => {
    const expense = await expenses.readExpense(expenseId);
    if (expense === undefined) return undefined;
    return {
      locationId: expense.locationId,
      currency: expense.amount.currency,
      businessDate: expense.businessDate,
      amount: expense.amount.amount,
    };
  };
}

/** The organization's timezone and currency, read through the organization module's index. */
export function buildReportOrganizationSettings(): OrganizationLocalSettings {
  const timezones = buildOrganizationTimezoneReader();
  const currencies = buildOrganizationCurrencyReader();
  return {
    timeZoneOf: (organizationId: string) => timezones.read(asId<OrganizationId>(organizationId)),
    currencyOf: (organizationId: string) => currencies.read(organizationId),
  };
}
