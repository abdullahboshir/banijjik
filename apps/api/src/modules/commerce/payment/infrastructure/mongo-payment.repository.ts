import type { CurrencyCode } from "@banijjik/contracts";
import { PAYMENT_DIRECTION, PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  asId,
  type LocationId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { Payment } from "../domain/payment.entity.js";
import {
  paymentReferenceTakenError,
  paymentReversalAlreadyReversedError,
} from "../domain/errors.js";
import type {
  ListPaymentsFilter,
  PaginatedResult,
  PaymentRepository,
} from "../application/ports/payment-repositories.js";
import { PAYMENT_MODEL_NAME, type PaymentDocument } from "./payment.schema.js";

function getPaymentModel(): Model<PaymentDocument> {
  return models({}).get<PaymentDocument>(PAYMENT_MODEL_NAME);
}

function toDomain(doc: PaymentDocument): Payment {
  return Payment.create({
    paymentId: asId<PaymentId>(doc.paymentId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    locationId: asId<LocationId>(doc.locationId),
    paymentNumber: doc.paymentNumber,
    direction: doc.direction,
    method: doc.method,
    amount: {
      amount: doc.amount.amount,
      currency: doc.amount.currency as CurrencyCode,
    },
    externalReference: doc.externalReference,
    reversesPaymentId: doc.reversesPaymentId,
    allocations: doc.allocations.map((a) => ({
      requestType: a.requestType,
      requestId: a.requestId,
      enrollmentPeriodId: a.enrollmentPeriodId,
      amount: {
        amount: a.amount.amount,
        currency: a.amount.currency as CurrencyCode,
      },
      ...(a.revenueState ? { revenueState: a.revenueState } : {}),
    })),
    writeOffs: (doc.writeOffs ?? []).map((w) => ({
      requestType: w.requestType,
      requestId: w.requestId,
      amount: { amount: w.amount.amount, currency: w.amount.currency as CurrencyCode },
    })),
    contactId: doc.contactId,
    receivedByMemberId: doc.receivedByMemberId,
    businessDate: doc.businessDate,
    approval: doc.approval
      ? {
          approvalId: doc.approval.approvalId,
          approverUserId: doc.approval.approverUserId,
          approvedAt: doc.approval.approvedAt,
        }
      : null,
    note: doc.note,
    posSessionId: doc.posSessionId ?? null,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: doc.createdByUserId ? asId<UserId>(doc.createdByUserId) : null,
    updatedByUserId: doc.updatedByUserId ? asId<UserId>(doc.updatedByUserId) : null,
  });
}

function toPaymentDocument(payment: Payment): PaymentDocument {
  const props = payment.toProps();
  return {
    paymentId: props.paymentId,
    organizationId: props.organizationId,
    locationId: props.locationId,
    paymentNumber: props.paymentNumber,
    direction: props.direction,
    method: props.method,
    amount: {
      amount: props.amount.amount,
      currency: props.amount.currency,
    },
    externalReference: props.externalReference,
    reversesPaymentId: props.reversesPaymentId,
    allocations: props.allocations.map((a) => ({
      requestType: a.requestType,
      requestId: a.requestId,
      enrollmentPeriodId: a.enrollmentPeriodId ?? null,
      amount: {
        amount: a.amount.amount,
        currency: a.amount.currency,
      },
      revenueState: a.revenueState ?? null,
    })),
    writeOffs: props.writeOffs.map((w) => ({
      requestType: w.requestType,
      requestId: w.requestId,
      amount: { amount: w.amount.amount, currency: w.amount.currency },
    })),
    contactId: props.contactId,
    receivedByMemberId: props.receivedByMemberId,
    businessDate: props.businessDate,
    approval: props.approval
      ? {
          approvalId: props.approval.approvalId,
          approverUserId: props.approval.approverUserId,
          approvedAt: props.approval.approvedAt,
        }
      : null,
    note: props.note,
    posSessionId: props.posSessionId ?? null,
    version: props.version,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    createdByUserId: props.createdByUserId,
    updatedByUserId: props.updatedByUserId,
  };
}

function isDuplicateMongoError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export class MongoPaymentRepository implements PaymentRepository {
  async create(payment: Payment): Promise<Payment> {
    const props = payment.toProps();
    const doc = toPaymentDocument(payment);

    try {
      await getPaymentModel().create([doc], sessionOption(getActiveSession()));
      return payment;
    } catch (error: unknown) {
      if (!isDuplicateMongoError(error)) throw error;
      if (props.reversesPaymentId) {
        throw paymentReversalAlreadyReversedError();
      }
      if (
        props.externalReference &&
        (props.method === PAYMENT_METHOD.BKASH || props.method === PAYMENT_METHOD.NAGAD)
      ) {
        const existing = await this.findByReference(
          props.organizationId,
          props.method,
          props.externalReference,
        );
        if (existing) throw paymentReferenceTakenError(existing.paymentId);
      }
      throw error;
    }
  }

  async findById(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<Payment | undefined> {
    const row = await getPaymentModel()
      .findOne({ organizationId, paymentId })
      .lean<PaymentDocument>();
    return row ? toDomain(row) : undefined;
  }

  async findByReference(
    organizationId: OrganizationId,
    method: import("@banijjik/contracts/payment").PaymentMethod,
    externalReference: string,
  ): Promise<Payment | undefined> {
    const row = await getPaymentModel()
      .findOne({ organizationId, method, externalReference })
      .lean<PaymentDocument>();
    return row ? toDomain(row) : undefined;
  }

  async findReversalOf(
    organizationId: OrganizationId,
    paymentId: string,
  ): Promise<Payment | undefined> {
    const row = await getPaymentModel()
      .findOne({
        organizationId,
        reversesPaymentId: paymentId,
        direction: PAYMENT_DIRECTION.REVERSAL,
      })
      .lean<PaymentDocument>();
    return row ? toDomain(row) : undefined;
  }

  async list(filter: ListPaymentsFilter): Promise<PaginatedResult<Payment>> {
    const query: QueryFilter<PaymentDocument> = {
      organizationId: filter.organizationId,
    };
    if (filter.locationId) {
      query.locationId = filter.locationId;
    }
    if (filter.contactId) {
      query.contactId = filter.contactId;
    }
    if (filter.method) {
      query.method = filter.method;
    }
    if (filter.direction) {
      query.direction = filter.direction;
    }
    if (filter.from || filter.to) {
      const dateFilter: Record<string, string> = {};
      if (filter.from) dateFilter["$gte"] = filter.from;
      if (filter.to) dateFilter["$lte"] = filter.to;
      query.businessDate = dateFilter;
    }

    const skip = (filter.page - 1) * filter.limit;
    const model = getPaymentModel();
    const [rows, total] = await Promise.all([
      model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean<PaymentDocument[]>(),
      model.countDocuments(query),
    ]);

    return {
      items: rows.map(toDomain),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }
}
