import {
  asId,
  InvalidIdError,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import { conflict } from "../../../../kernel/http/index.js";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  DeliveryAttemptPage,
  DeliveryAttemptRepository,
} from "../application/ports/delivery-attempt.repository.js";
import { DeliveryAttempt } from "../domain/delivery-attempt.entity.js";
import {
  DELIVERY_ATTEMPT_MODEL_NAME,
  type DeliveryAttemptDocument,
} from "./delivery-attempt.schema.js";

function attemptModel(): Model<DeliveryAttemptDocument> {
  return models({}).get<DeliveryAttemptDocument>(DELIVERY_ATTEMPT_MODEL_NAME);
}

function actorOf(value: string | null): UserId {
  if (value === null) throw new InvalidIdError();
  return asId<UserId>(value);
}

function toAttempt(row: DeliveryAttemptDocument): DeliveryAttempt {
  return DeliveryAttempt.restore({
    deliveryAttemptId: row.deliveryAttemptId,
    organizationId: asId<OrganizationId>(row.organizationId),
    orderId: asId<OrderId>(row.orderId),
    ordinal: row.ordinal,
    method: row.method,
    consignmentId: row.consignmentId,
    deliveryAssignmentId: row.deliveryAssignmentId,
    startedAt: row.startedAt,
    failedAt: row.failedAt,
    reasonKey: row.reasonKey,
    note: row.note,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: actorOf(row.createdByUserId),
    updatedByUserId: actorOf(row.updatedByUserId),
  });
}

function toDocument(attempt: DeliveryAttempt): DeliveryAttemptDocument {
  return {
    deliveryAttemptId: attempt.deliveryAttemptId,
    organizationId: attempt.organizationId,
    orderId: attempt.orderId,
    ordinal: attempt.ordinal,
    method: attempt.method,
    consignmentId: attempt.consignmentId,
    deliveryAssignmentId: attempt.deliveryAssignmentId,
    startedAt: attempt.startedAt,
    failedAt: attempt.failedAt,
    reasonKey: attempt.reasonKey,
    note: attempt.note,
    version: attempt.version,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
    createdByUserId: attempt.createdByUserId,
    updatedByUserId: attempt.updatedByUserId,
  };
}

type MutableAttemptFields = Omit<
  DeliveryAttemptDocument,
  "deliveryAttemptId" | "organizationId" | "orderId" | "ordinal" | "version"
>;

function mutableFieldsOf(attempt: DeliveryAttempt): MutableAttemptFields {
  return {
    method: attempt.method,
    consignmentId: attempt.consignmentId,
    deliveryAssignmentId: attempt.deliveryAssignmentId,
    startedAt: attempt.startedAt,
    failedAt: attempt.failedAt,
    reasonKey: attempt.reasonKey,
    note: attempt.note,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
    createdByUserId: attempt.createdByUserId,
    updatedByUserId: attempt.updatedByUserId,
  };
}

export class MongoDeliveryAttemptRepository implements DeliveryAttemptRepository {
  async insert(attempt: DeliveryAttempt): Promise<void> {
    try {
      await attemptModel().create([toDocument(attempt)], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error)) throw conflict({});
      throw error;
    }
  }

  async findById(
    organizationId: OrganizationId,
    deliveryAttemptId: string,
  ): Promise<DeliveryAttempt | undefined> {
    const row = await attemptModel()
      .findOne({ organizationId, deliveryAttemptId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<DeliveryAttemptDocument>();
    return row === null ? undefined : toAttempt(row);
  }

  async listByOrder(input: {
    readonly organizationId: OrganizationId;
    readonly orderId: OrderId;
    readonly page: number;
    readonly limit: number;
  }): Promise<DeliveryAttemptPage> {
    const rows = await attemptModel()
      .find(
        { organizationId: input.organizationId, orderId: input.orderId },
        { _id: 0 },
        sessionOption(getActiveSession()),
      )
      .sort({ startedAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit + 1)
      .lean<DeliveryAttemptDocument[]>();
    return {
      items: rows.slice(0, input.limit).map(toAttempt),
      hasNext: rows.length > input.limit,
    };
  }

  async update(attempt: DeliveryAttempt, expectedVersion: number): Promise<DeliveryAttempt> {
    const updated = await updateVersioned({
      model: attemptModel(),
      filter: {
        organizationId: attempt.organizationId,
        deliveryAttemptId: attempt.deliveryAttemptId,
      },
      expectedVersion,
      update: { $set: mutableFieldsOf(attempt) },
    });
    return toAttempt(updated);
  }
}
