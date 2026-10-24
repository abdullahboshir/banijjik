import type { CurrencyCode } from "@banijjik/contracts";
import { PAYMENT_STATUS, type PaymentRequestType } from "@banijjik/contracts/payment";
import { asId, type LocationId, type OrganizationId } from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { paymentAllocationsInvalidError, paymentRefundExceedsPaidError } from "../domain/errors.js";
import { computePaymentStatus } from "../domain/payment-rules.js";
import { PaymentSummary } from "../domain/payment-summary.entity.js";
import type {
  ApplyAllocationInput,
  ApplyRefundInput,
  EnsureSummaryInput,
  ListDuesFilter,
  PaginatedResult,
  PaymentSummaryRepository,
  RestoreAllocationInput,
  CloseSummaryInput,
  SetSummaryTotalInput,
  SetSummaryContactInput,
} from "../application/ports/payment-repositories.js";
import {
  PAYMENT_SUMMARY_MODEL_NAME,
  type PaymentSummaryDocument,
} from "./payment-summary.schema.js";

function getPaymentSummaryModel(): Model<PaymentSummaryDocument> {
  return models({}).get<PaymentSummaryDocument>(PAYMENT_SUMMARY_MODEL_NAME);
}

function toDomain(doc: PaymentSummaryDocument): PaymentSummary {
  return PaymentSummary.create({
    organizationId: asId<OrganizationId>(doc.organizationId),
    requestType: doc.requestType,
    requestId: doc.requestId,
    contactId: doc.contactId,
    locationId: asId<LocationId>(doc.locationId),
    total: {
      amount: doc.total.amount,
      currency: doc.total.currency as CurrencyCode,
    },
    allocated: {
      amount: doc.allocated.amount,
      currency: doc.allocated.currency as CurrencyCode,
    },
    refunded: {
      amount: doc.refunded.amount,
      currency: doc.refunded.currency as CurrencyCode,
    },
    paymentStatus: computePaymentStatus(
      doc.total.amount,
      doc.allocated.amount,
      doc.refunded.amount,
    ),
    closedAt: doc.closedAt ?? null,
    updatedAt: doc.updatedAt,
  });
}

export class MongoPaymentSummaryRepository implements PaymentSummaryRepository {
  async findByRequests(
    organizationId: OrganizationId,
    requestType: PaymentRequestType,
    requestIds: readonly string[],
  ): Promise<readonly PaymentSummary[]> {
    const rows = await getPaymentSummaryModel()
      .find(
        { organizationId, requestType, requestId: { $in: requestIds } },
        { _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<PaymentSummaryDocument[]>();
    return rows.map(toDomain);
  }

  async findByRequest(
    organizationId: OrganizationId,
    requestType: PaymentRequestType,
    requestId: string,
  ): Promise<PaymentSummary | undefined> {
    const row = await getPaymentSummaryModel()
      .findOne({ organizationId, requestType, requestId }, null, sessionOption(getActiveSession()))
      .lean<PaymentSummaryDocument>();
    return row ? toDomain(row) : undefined;
  }

  async ensureSummary(input: EnsureSummaryInput): Promise<void> {
    const model = getPaymentSummaryModel();
    const session = sessionOption(getActiveSession());
    await model.updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
      },
      {
        $setOnInsert: {
          requestType: input.requestType,
          requestId: input.requestId,
          locationId: input.locationId,
          contactId: input.contactId,
          total: {
            amount: input.total.amount,
            currency: input.total.currency,
          },
          allocated: { amount: 0, currency: input.total.currency },
          refunded: { amount: 0, currency: input.total.currency },
          paymentStatus: PAYMENT_STATUS.UNPAID,
        },
      },
      { upsert: true, ...session },
    );
  }

  async setContact(input: SetSummaryContactInput): Promise<void> {
    await getPaymentSummaryModel().updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
      },
      { $set: { contactId: input.contactId, updatedAt: input.now } },
      sessionOption(getActiveSession()),
    );
  }

  async setTotal(input: SetSummaryTotalInput): Promise<void> {
    const model = getPaymentSummaryModel();
    const session = sessionOption(getActiveSession());
    await model.updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
      },
      {
        $set: {
          "total.amount": input.total.amount,
          updatedAt: input.now,
        },
      },
      session,
    );
  }

  async closeAtTotal(input: CloseSummaryInput): Promise<void> {
    await this.setTotal(input);
    // The tenant plugin refuses pipeline updates, so the first close time is a second write that
    // only matches a summary not closed yet (missing and null both match).
    await getPaymentSummaryModel().updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
        closedAt: null,
      },
      { $set: { closedAt: input.now } },
      sessionOption(getActiveSession()),
    );
  }

  async applyAllocation(input: ApplyAllocationInput): Promise<void> {
    const model = getPaymentSummaryModel();
    const session = sessionOption(getActiveSession());

    await this.ensureSummary({
      organizationId: input.organizationId,
      locationId: input.locationId,
      requestType: input.requestType,
      requestId: input.requestId,
      contactId: input.contactId,
      total: input.total,
      now: input.now,
    });

    const result = await model.updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
        $expr: {
          $lte: [
            { $add: [{ $subtract: ["$allocated.amount", "$refunded.amount"] }, input.amount] },
            "$total.amount",
          ],
        },
      },
      {
        $inc: { "allocated.amount": input.amount },
        $set: { updatedAt: input.now },
      },
      session,
    );

    if (result.matchedCount === 0) {
      throw paymentAllocationsInvalidError(
        `Allocation of ${input.amount} exceeds remaining total for ${input.requestId}`,
      );
    }
  }

  async applyRefund(input: ApplyRefundInput): Promise<void> {
    const model = getPaymentSummaryModel();
    const session = sessionOption(getActiveSession());

    const result = await model.updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
        $expr: {
          $lte: [{ $add: ["$refunded.amount", input.amount] }, "$allocated.amount"],
        },
      },
      {
        $inc: { "refunded.amount": input.amount },
        $set: { updatedAt: input.now },
      },
      session,
    );

    if (result.matchedCount === 0) {
      throw paymentRefundExceedsPaidError();
    }
  }

  async restoreAllocation(input: RestoreAllocationInput): Promise<void> {
    const model = getPaymentSummaryModel();
    const session = sessionOption(getActiveSession());

    await model.updateOne(
      {
        organizationId: input.organizationId,
        requestType: input.requestType,
        requestId: input.requestId,
      },
      {
        $inc: { "allocated.amount": -input.amount },
        $set: { updatedAt: input.now },
      },
      session,
    );
  }

  async listDues(filter: ListDuesFilter): Promise<PaginatedResult<PaymentSummary>> {
    const query: QueryFilter<PaymentSummaryDocument> = {
      organizationId: filter.organizationId,
      $expr: {
        $gt: ["$total.amount", { $subtract: ["$allocated.amount", "$refunded.amount"] }],
      },
    };
    if (filter.locationId) {
      query.locationId = filter.locationId;
    } else if (filter.allowedLocationIds && filter.allowedLocationIds !== "ALL") {
      query.locationId = { $in: filter.allowedLocationIds };
    }
    if (filter.contactId) {
      query.contactId = filter.contactId;
    }
    if (filter.requestType) {
      query.requestType = filter.requestType;
    }

    const skip = (filter.page - 1) * filter.limit;
    const model = getPaymentSummaryModel();
    const [rows, total] = await Promise.all([
      model
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean<PaymentSummaryDocument[]>(),
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
