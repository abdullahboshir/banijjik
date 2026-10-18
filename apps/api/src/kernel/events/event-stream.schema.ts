import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const EVENT_STREAM_MODEL_NAME = "EventStream";
export const EVENT_STREAM_COLLECTION_NAME = "event_streams";
export const EVENT_STREAM_POSITION_MODEL_NAME = "EventStreamPosition";
export const EVENT_STREAM_POSITION_COLLECTION_NAME = "event_stream_positions";

/**
 * The counter of one stream: the events of one record, such as `order:<orderId>`, numbered in the
 * order they were published (card 3.8a, ADR-115). `publishEvent` increments it in the publishing
 * transaction, so a rolled-back change leaves no gap.
 */
export interface EventStreamDocument {
  eventStreamId: string;
  /** Null for a stream of user-level events. */
  organizationId: string | null;
  orderingKey: string;
  lastSequence: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** How far one handler has got in one stream: the last sequence it handled (or skipped, with its module off). */
export interface EventStreamPositionDocument {
  eventStreamPositionId: string;
  handlerKey: string;
  organizationId: string | null;
  orderingKey: string;
  lastSequence: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const eventStreamSchema = new Schema<EventStreamDocument>(
  {
    ...domainIdField("eventStreamId"),
    organizationId: { type: String, default: null },
    orderingKey: { type: String, required: true },
    lastSequence: { type: Number, required: true, default: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

eventStreamSchema.index({ eventStreamId: 1 }, { unique: true });
// One counter per record of one organization: the publisher increments it in its own transaction.
eventStreamSchema.index({ organizationId: 1, orderingKey: 1 }, { unique: true });

const eventStreamPositionSchema = new Schema<EventStreamPositionDocument>(
  {
    ...domainIdField("eventStreamPositionId"),
    handlerKey: { type: String, required: true },
    organizationId: { type: String, default: null },
    orderingKey: { type: String, required: true },
    lastSequence: { type: Number, required: true, default: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

eventStreamPositionSchema.index({ eventStreamPositionId: 1 }, { unique: true });
eventStreamPositionSchema.index(
  { handlerKey: 1, organizationId: 1, orderingKey: 1 },
  { unique: true },
);

/** Both are kernel-only models without tenancy, like the outbox: the worker spans every organization (ADR-090). */
export function registerEventStreamModels(): void {
  registerModel({
    modelName: EVENT_STREAM_MODEL_NAME,
    collectionName: EVENT_STREAM_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: eventStreamSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    modelName: EVENT_STREAM_POSITION_MODEL_NAME,
    collectionName: EVENT_STREAM_POSITION_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: eventStreamPositionSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
