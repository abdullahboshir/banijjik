import { SALES_RETURN_STATUS } from "@banijjik/contracts/sales";
import type { OrderId, OrganizationId, SalesReturnId } from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  SalesReturnListFilter,
  SalesReturnPage,
  SalesReturnRepository,
} from "../application/ports/sales-return-ports.js";
import type { SalesReturnRecord } from "../domain/sales-return.record.js";
import { toSalesReturnDocument, toSalesReturnRecord } from "./mongo-sales-return.mapper.js";
import { SALES_RETURN_MODEL_NAME, type SalesReturnDocument } from "./sales-return.schema.js";

function returnModel(): Model<SalesReturnDocument> {
  return models({}).get<SalesReturnDocument>(SALES_RETURN_MODEL_NAME);
}

/** The list reads the index `{ organizationId, locationId, businessDate, salesReturnId }` in order. */
function filterOf(filter: SalesReturnListFilter): QueryFilter<SalesReturnDocument> {
  const query: QueryFilter<SalesReturnDocument> = {};
  if (filter.locationIds !== "ALL") query.locationId = { $in: [...filter.locationIds] };
  if (filter.orderId !== undefined) query.orderId = filter.orderId;
  if (filter.from !== undefined || filter.to !== undefined) {
    const businessDate: { $gte?: string; $lte?: string } = {};
    if (filter.from !== undefined) businessDate.$gte = filter.from;
    if (filter.to !== undefined) businessDate.$lte = filter.to;
    query.businessDate = businessDate;
  }
  return query;
}

export class MongoSalesReturnRepository implements SalesReturnRepository {
  async insert(record: SalesReturnRecord): Promise<void> {
    await returnModel().create([toSalesReturnDocument(record)], sessionOption(getActiveSession()));
  }

  async findById(salesReturnId: SalesReturnId): Promise<SalesReturnRecord | undefined> {
    const row = await returnModel()
      .findOne({ salesReturnId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<SalesReturnDocument>();
    return row === null ? undefined : toSalesReturnRecord(row);
  }

  async reverse(
    input: Parameters<SalesReturnRepository["reverse"]>[0],
  ): Promise<SalesReturnRecord> {
    const updated = await updateVersioned({
      model: returnModel(),
      filter: { salesReturnId: input.salesReturnId, status: SALES_RETURN_STATUS.ACTIVE },
      expectedVersion: input.expectedVersion,
      update: {
        $set: {
          status: SALES_RETURN_STATUS.REVERSED,
          reversal: input.reversal,
          updatedAt: input.reversal.reversedAt,
          updatedByUserId: input.reversal.reversedByUserId,
        },
      },
    });
    return toSalesReturnRecord(updated);
  }

  async sumActiveDeliveryReturned(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<number> {
    const [row] = await returnModel()
      .aggregate<{ total: number }>(
        [
          {
            $match: {
              organizationId,
              orderId,
              status: SALES_RETURN_STATUS.ACTIVE,
            },
          },
          { $group: { _id: null, total: { $sum: "$deliveryChargeReturned.amount" } } },
        ],
        sessionOption(getActiveSession()),
      )
      .exec();
    return row?.total ?? 0;
  }

  async list(filter: SalesReturnListFilter): Promise<SalesReturnPage> {
    const skip = (filter.page - 1) * filter.limit;
    const rows = await returnModel()
      .find(filterOf(filter), { _id: 0 })
      .sort({ businessDate: -1, salesReturnId: -1 })
      .skip(skip)
      .limit(filter.limit + 1)
      .lean<SalesReturnDocument[]>();
    return {
      items: rows.slice(0, filter.limit).map(toSalesReturnRecord),
      hasNext: rows.length > filter.limit,
    };
  }
}
