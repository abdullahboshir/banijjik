import type { Money } from "@banijjik/contracts/pricing";
import { PAYMENT_REQUEST_TYPE, type PaymentRequestType } from "@banijjik/contracts/payment";
import type { OrderLineSnapshot } from "@banijjik/contracts/sales";
import type {
  StorefrontOrderFulfillmentMethod,
  StorefrontOrderItem,
  StorefrontRequestPlan,
  StorefrontRequestSchedule,
} from "@banijjik/contracts/website";
import { asId, type BookingId, type OrderId, type OrganizationId } from "@banijjik/ids";
import { MongoBookingRepository } from "../modules/commerce/booking/index.js";
import { MongoEnrollmentRepository } from "../modules/commerce/enrollment/index.js";
import { MongoPaymentSummaryRepository } from "../modules/commerce/payment/index.js";
import { MongoOrderRepository } from "../modules/commerce/sales/index.js";
import {
  statusKey,
  type RequestStatusReadInput,
  type RequestStatusReaderPort,
  type RequestStatusSnapshot,
} from "../modules/commerce/website/index.js";

/** The fields tracking reads from each module's live record; the domain entities satisfy them. */
export interface OrderStatusFields {
  readonly orderId: string;
  readonly organizationId: string;
  readonly orderNumber: string | null;
  readonly status: string;
  readonly totals: { readonly grandTotal: Money };
  readonly lines: readonly OrderLineSnapshot[];
  readonly fulfillment: { readonly method: StorefrontOrderFulfillmentMethod };
  readonly createdAt: Date;
}

export interface BookingStatusFields {
  readonly bookingId: string;
  readonly organizationId: string;
  readonly bookingNumber: string | null;
  readonly status: string;
  readonly depositRequired: Money;
  readonly holdExpiresAt: Date | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly createdAt: Date;
}

export interface EnrollmentStatusFields {
  readonly enrollmentId: string;
  readonly organizationId: string;
  readonly enrollmentNumber: string;
  readonly status: string;
  readonly currentEnrollmentPeriodId: string;
  readonly startsOn: string;
  readonly endsOn?: string;
  readonly firstRecurringFee: Money;
  readonly createdAt: Date;
}

export interface StatusSummaryFields {
  readonly requestId: string;
  readonly due: Money;
}

export interface StorefrontRequestStatusSources {
  readonly orders: {
    findByIds(orderIds: readonly OrderId[]): Promise<readonly OrderStatusFields[]>;
  };
  readonly bookings: {
    findByIds(bookingIds: readonly BookingId[]): Promise<readonly BookingStatusFields[]>;
  };
  readonly enrollments: {
    findByIds(enrollmentIds: readonly string[]): Promise<readonly EnrollmentStatusFields[]>;
  };
  readonly summaries: {
    findByRequests(
      organizationId: OrganizationId,
      requestType: PaymentRequestType,
      requestIds: readonly string[],
    ): Promise<readonly StatusSummaryFields[]>;
  };
}

export function projectStorefrontOrderItems(
  lines: readonly OrderLineSnapshot[],
): readonly StorefrontOrderItem[] {
  return lines.map((line) => ({
    name: line.nameSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));
}

export function toOrderSnapshot(
  order: OrderStatusFields,
  summary: StatusSummaryFields | undefined,
): RequestStatusSnapshot {
  return {
    requestId: order.orderId,
    requestType: "ORDER",
    publicNumber: order.orderNumber,
    status: order.status,
    paymentRequired: summary ? summary.due : order.totals.grandTotal,
    holdExpiresAt: null,
    createdAt: order.createdAt,
    items: projectStorefrontOrderItems(order.lines),
    fulfillment: { method: order.fulfillment.method },
  };
}

export function toBookingSnapshot(
  booking: BookingStatusFields,
  summary: StatusSummaryFields | undefined,
): RequestStatusSnapshot {
  const schedule: StorefrontRequestSchedule = {
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
  };
  return {
    requestId: booking.bookingId,
    requestType: "BOOKING",
    publicNumber: booking.bookingNumber,
    status: booking.status,
    paymentRequired: summary ? summary.due : booking.depositRequired,
    holdExpiresAt: booking.holdExpiresAt,
    createdAt: booking.createdAt,
    schedule,
  };
}

export function toEnrollmentSnapshot(
  enrollment: EnrollmentStatusFields,
  summary: StatusSummaryFields | undefined,
): RequestStatusSnapshot {
  const plan: StorefrontRequestPlan = {
    startsOn: enrollment.startsOn,
    endsOn: enrollment.endsOn ?? null,
  };
  return {
    requestId: enrollment.enrollmentId,
    requestType: "ENROLLMENT",
    publicNumber: enrollment.enrollmentNumber,
    status: enrollment.status,
    paymentRequired: summary
      ? summary.due
      : { amount: 0, currency: enrollment.firstRecurringFee.currency },
    holdExpiresAt: null,
    createdAt: enrollment.createdAt,
    plan,
  };
}

async function readOrderStatuses(
  inputs: readonly RequestStatusReadInput[],
  sources: StorefrontRequestStatusSources,
): Promise<readonly RequestStatusSnapshot[]> {
  const first = inputs[0];
  if (!first) return [];
  const organizationId = asId<OrganizationId>(first.organizationId);
  const ids = [...new Set(inputs.map((input) => input.requestId))];
  const [rows, summaries] = await Promise.all([
    sources.orders.findByIds(ids.map((id) => asId<OrderId>(id))),
    sources.summaries.findByRequests(organizationId, PAYMENT_REQUEST_TYPE.ORDER, ids),
  ]);
  const orderById = new Map(
    rows.filter((row) => row.organizationId === organizationId).map((row) => [row.orderId, row]),
  );
  const summaryById = new Map(summaries.map((summary) => [summary.requestId, summary]));
  return inputs.flatMap((input) => {
    const order = orderById.get(input.requestId);
    return order ? [toOrderSnapshot(order, summaryById.get(order.orderId))] : [];
  });
}

async function readBookingStatuses(
  inputs: readonly RequestStatusReadInput[],
  sources: StorefrontRequestStatusSources,
): Promise<readonly RequestStatusSnapshot[]> {
  const first = inputs[0];
  if (!first) return [];
  const organizationId = asId<OrganizationId>(first.organizationId);
  const ids = [...new Set(inputs.map((input) => input.requestId))];
  const [rows, summaries] = await Promise.all([
    sources.bookings.findByIds(ids.map((id) => asId<BookingId>(id))),
    sources.summaries.findByRequests(organizationId, PAYMENT_REQUEST_TYPE.BOOKING, ids),
  ]);
  const bookingById = new Map(
    rows.filter((row) => row.organizationId === organizationId).map((row) => [row.bookingId, row]),
  );
  const summaryById = new Map(summaries.map((summary) => [summary.requestId, summary]));
  return inputs.flatMap((input) => {
    const booking = bookingById.get(input.requestId);
    return booking ? [toBookingSnapshot(booking, summaryById.get(booking.bookingId))] : [];
  });
}

async function readEnrollmentStatuses(
  inputs: readonly RequestStatusReadInput[],
  sources: StorefrontRequestStatusSources,
): Promise<readonly RequestStatusSnapshot[]> {
  const first = inputs[0];
  if (!first) return [];
  const organizationId = asId<OrganizationId>(first.organizationId);
  const ids = [...new Set(inputs.map((input) => input.requestId))];
  const rows = await sources.enrollments.findByIds(ids);
  const enrollmentById = new Map(
    rows
      .filter((row) => row.organizationId === organizationId)
      .map((row) => [row.enrollmentId, row]),
  );
  // ADR-139: an enrollment's payment request is its current period, not the enrollment ID.
  const periodIds = [
    ...new Set([...enrollmentById.values()].map((row) => row.currentEnrollmentPeriodId)),
  ];
  const summaries =
    periodIds.length === 0
      ? []
      : await sources.summaries.findByRequests(
          organizationId,
          PAYMENT_REQUEST_TYPE.ENROLLMENT,
          periodIds,
        );
  const summaryByPeriod = new Map(summaries.map((summary) => [summary.requestId, summary]));
  return inputs.flatMap((input) => {
    const enrollment = enrollmentById.get(input.requestId);
    if (!enrollment) return [];
    return [
      toEnrollmentSnapshot(enrollment, summaryByPeriod.get(enrollment.currentEnrollmentPeriodId)),
    ];
  });
}

function defaultSources(): StorefrontRequestStatusSources {
  return {
    orders: new MongoOrderRepository(),
    bookings: new MongoBookingRepository(),
    enrollments: new MongoEnrollmentRepository(),
    summaries: new MongoPaymentSummaryRepository(),
  };
}

export function buildStorefrontRequestStatusReaderAdapter(
  sources: StorefrontRequestStatusSources = defaultSources(),
): RequestStatusReaderPort {
  return {
    readStatuses: async (inputs) => {
      const groups = await Promise.all([
        readOrderStatuses(
          inputs.filter((input) => input.requestType === "ORDER"),
          sources,
        ),
        readBookingStatuses(
          inputs.filter((input) => input.requestType === "BOOKING"),
          sources,
        ),
        readEnrollmentStatuses(
          inputs.filter((input) => input.requestType === "ENROLLMENT"),
          sources,
        ),
      ]);
      return new Map(
        groups
          .flat()
          .map((snapshot) => [statusKey(snapshot.requestType, snapshot.requestId), snapshot]),
      );
    },
  };
}
