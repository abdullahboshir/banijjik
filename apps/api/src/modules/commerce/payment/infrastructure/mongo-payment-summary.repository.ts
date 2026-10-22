import type { CurrencyCode } from "@banijjik/contracts";
import type { PaymentRequestType } from "@banijjik/contracts/payment";
import { asId, type LocationId, type OrganizationId } from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { PaymentSummary } from "../domain/payment-summary.entity.js";
import type {
  ListDuesFilter,
  PaginatedResult,
  PaymentSummaryRepository,
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
    locationId: doc.locationId ? asId<LocationId>(doc.locationId) : null,
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
    paymentStatus: doc.paymentStatus,
    updatedAt: doc.updatedAt,
  });
}

export class MongoPaymentSummaryRepository implements PaymentSummaryRepository {
  async findByRequest(
    organizationId: OrganizationId,
    requestType: PaymentRequestType,
    requestId: string,
  ): Promise<PaymentSummary | undefined> {
    const row = await getPaymentSummaryModel()
      .findOne({ organizationId, requestType, requestId })
      .lean<PaymentSummaryDocument>();
    return row ? toDomain(row) : undefined;
  }

  async upsert(summary: PaymentSummary): Promise<void> {
    const props = summary.toProps();
    await getPaymentSummaryModel().updateOne(
      {
        organizationId: props.organizationId,
        requestType: props.requestType,
        requestId: props.requestId,
      },
      {
        $set: {
          contactId: props.contactId,
          locationId: props.locationId,
          total: {
            amount: props.total.amount,
            currency: props.total.currency,
          },
          allocated: {
            amount: props.allocated.amount,
            currency: props.allocated.currency,
          },
          refunded: {
            amount: props.refunded.amount,
            currency: props.refunded.currency,
          },
          paymentStatus: props.paymentStatus,
          updatedAt: props.updatedAt,
        },
      },
      { upsert: true, ...sessionOption(getActiveSession()) },
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
