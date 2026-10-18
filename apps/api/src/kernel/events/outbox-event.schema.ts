import {
  DATABASE_KIND,
  MODEL_TENANCY,
  OUTBOX_STATUS,
  type OutboxStatus,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const OUTBOX_EVENT_MODEL_NAME = "OutboxEvent";
export const OUTBOX_EVENT_COLLECTION_NAME = "outbox_events";
const DISPATCHED_EVENT_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export interface OutboxEventDocument {
  /** The event's own ID (UUID v7); it is also the ID inside the envelope. */
  eventId: string;
  type: string;
  version: number;
  occurredAt: Date;
  organizationId: string | null;
  actorUserId: string | null;
  requestId: string;
  payload: Record<string, unknown>;
  /** The record whose events stay in order, such as `order:<orderId>`; null for an unordered event (card 3.8a). */
  orderingKey: string | null;
  /** The event's number in its stream, 1, 2, 3 in publishing order; null without a key. */
  streamSequence: number | null;
  status: OutboxStatus;
  dispatchAttempts: number;
  nextAttemptAt: Date;
  /** A claim by one dispatcher; another one may take the event once this time has passed. */
  lockedUntil: Date | null;
  dispatchedAt: Date | null;
  /** Error class and code only: a driver message can carry user data. */
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const outboxEventSchema = new Schema<OutboxEventDocument>(
  {
    ...domainIdField("eventId"),
    type: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    occurredAt: { type: Date, required: true },
    organizationId: { type: String, default: null },
    actorUserId: { type: String, default: null },
    requestId: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    orderingKey: { type: String, default: null },
    streamSequence: { type: Number, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(OUTBOX_STATUS),
      default: OUTBOX_STATUS.PENDING,
    },
    dispatchAttempts: { type: Number, required: true, default: 0 },
    nextAttemptAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

outboxEventSchema.index({ eventId: 1 }, { unique: true });
// The dispatcher's claim query: pending events that are due, the lower stream sequence first (ADR-115).
outboxEventSchema.index({ status: 1, nextAttemptAt: 1, streamSequence: 1 });
// Dispatched events are kept for a month for diagnosis; DEAD ones have no dispatchedAt and stay.
outboxEventSchema.index(
  { dispatchedAt: 1 },
  { expireAfterSeconds: DISPATCHED_EVENT_RETENTION_SECONDS },
);

/** The dispatcher spans every organization, so the outbox is a kernel-only model without tenancy (ADR-090). */
export function registerOutboxEventModel(): void {
  registerModel({
    modelName: OUTBOX_EVENT_MODEL_NAME,
    collectionName: OUTBOX_EVENT_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: outboxEventSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
