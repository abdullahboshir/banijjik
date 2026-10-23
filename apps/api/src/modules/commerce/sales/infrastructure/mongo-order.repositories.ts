import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { newId, type OrderId } from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { conflict, notFound } from "../../../../kernel/http/index.js";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  OrderCounter,
  OrderListFilter,
  OrderPage,
  OrderRepository,
} from "../application/ports/sales-ports.js";
import { Order } from "../domain/order.entity.js";
import {
  orderDocument,
  orderMutableFields,
  toOrder,
  toOrderListRow,
  type OrderListDocument,
} from "./mongo-order.mapper.js";
import {
  ORDER_COUNTER_MODEL_NAME,
  ORDER_MODEL_NAME,
  type OrderCounterDocument,
  type OrderDocument,
} from "./sales.schema.js";

function orderModel(): Model<OrderDocument> {
  return models({}).get<OrderDocument>(ORDER_MODEL_NAME);
}

function counterModel(): Model<OrderCounterDocument> {
  return models({}).get<OrderCounterDocument>(ORDER_COUNTER_MODEL_NAME);
}

/** The list projection (decision 9): `_id` excluded, line snapshots never read. */
const LIST_ROW_PROJECTION = {
  _id: 0,
  orderId: 1,
  orderNumber: 1,
  status: 1,
  contactId: 1,
  createdAt: 1,
  "totals.grandTotal": 1,
};

/** A guarded delete needs the stored version to tell a stale write from a missing order. */
async function throwDeleteConflict(orderId: OrderId, expectedVersion: number): Promise<never> {
  const current = await orderModel()
    .findOne({ orderId }, { version: 1 }, sessionOption(getActiveSession()))
    .lean<Pick<OrderDocument, "version"> | null>();
  if (current === null) throw notFound();
  throw conflict({ expectedVersion, currentVersion: current.version });
}
export class MongoOrderRepository implements OrderRepository {
  async insert(order: Order): Promise<void> {
    await orderModel().create([orderDocument(order)], sessionOption(getActiveSession()));
  }

  async findById(orderId: OrderId): Promise<Order | undefined> {
    const row = await orderModel().findOne({ orderId }).lean<OrderDocument>();
    return row === null ? undefined : toOrder(row);
  }

  async update(order: Order, expectedVersion: number): Promise<Order> {
    const updated = await updateVersioned({
      model: orderModel(),
      filter: { orderId: order.orderId },
      expectedVersion,
      update: { $set: orderMutableFields(order) },
    });
    return toOrder(updated);
  }

  async deleteDraft(orderId: OrderId, expectedVersion: number): Promise<void> {
    const result = await orderModel().deleteOne(
      { orderId, version: expectedVersion },
      sessionOption(getActiveSession()),
    );
    if (result.deletedCount === 1) return;
    await throwDeleteConflict(orderId, expectedVersion);
  }

  async list(filter: OrderListFilter): Promise<OrderPage> {
    const rows = await orderModel()
      .find(queryOf(filter), LIST_ROW_PROJECTION)
      .sort({ createdAt: -1, orderId: 1 })
      .limit(filter.limit + 1)
      .skip((filter.page - 1) * filter.limit)
      .lean<OrderListDocument[]>();
    return {
      items: rows.slice(0, filter.limit).map(toOrderListRow),
      hasNext: rows.length > filter.limit,
    };
  }

  async findDraftsCreatedBefore(cutoff: Date, limit: number): Promise<readonly Order[]> {
    return findByStatusCreatedBefore(ORDER_STATUS.DRAFT, cutoff, limit);
  }

  async findPlacedCreatedBefore(cutoff: Date, limit: number): Promise<readonly Order[]> {
    return findByStatusCreatedBefore(ORDER_STATUS.PLACED, cutoff, limit);
  }
}

/** The job scans walk the `{ organizationId, status, createdAt, orderId }` index in order. */
async function findByStatusCreatedBefore(
  status: OrderDocument["status"],
  cutoff: Date,
  limit: number,
): Promise<readonly Order[]> {
  const rows = await orderModel()
    .find({ status, createdAt: { $lt: cutoff } })
    .sort({ createdAt: 1, orderId: 1 })
    .limit(limit)
    .lean<OrderDocument[]>();
  return rows.map(toOrder);
}

function queryOf(filter: OrderListFilter): QueryFilter<OrderDocument> {
  const query: QueryFilter<OrderDocument> = {};
  if (filter.locationIds !== "ALL") query.locationId = { $in: [...filter.locationIds] };
  if (filter.status !== undefined) query.status = filter.status;
  if (filter.contactIds !== undefined) query.contactId = { $in: [...filter.contactIds] };
  if (filter.orderNumber !== undefined) query.orderNumber = filter.orderNumber;
  if (filter.search !== undefined) query.$or = searchBranchesOf(filter.search);
  if (filter.from !== undefined || filter.to !== undefined) {
    const createdAt: { $gte?: Date; $lte?: Date } = {};
    if (filter.from !== undefined) createdAt.$gte = filter.from;
    if (filter.to !== undefined) createdAt.$lte = filter.to;
    query.createdAt = createdAt;
  }
  return query;
}

/** `q` matches the number exactly or a contact the term found; both branches are indexed. */
function searchBranchesOf(
  search: NonNullable<OrderListFilter["search"]>,
): QueryFilter<OrderDocument>[] {
  const branches: QueryFilter<OrderDocument>[] = [{ orderNumber: search.orderNumber }];
  if (search.contactIds.length > 0) {
    branches.push({ contactId: { $in: [...search.contactIds] } });
  }
  return branches;
}

export class MongoOrderCounter implements OrderCounter {
  async increment(monthKey: string): Promise<number> {
    const row = await counterModel()
      .findOneAndUpdate(
        { monthKey },
        { $inc: { count: 1 }, $setOnInsert: { orderCounterId: newId(), monthKey } },
        { upsert: true, returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<OrderCounterDocument>();
    return row?.count ?? 1;
  }
}
