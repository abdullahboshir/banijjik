import { DATABASE_KIND, EVENT_DEAD_LETTER_STATUS, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export type EventDeadLetterStatus =
  (typeof EVENT_DEAD_LETTER_STATUS)[keyof typeof EVENT_DEAD_LETTER_STATUS];

export const EVENT_DEAD_LETTER_MODEL_NAME = "EventDeadLetter";
export const EVENT_DEAD_LETTER_COLLECTION_NAME = "event_dead_letters";

/** A handler that failed its last attempt. The event's other handlers are not affected. */
export interface EventDeadLetterDocument {
  eventDeadLetterId: string;
  eventId: string;
  handlerKey: string;
  type: string;
  organizationId: string | null;
  /** FAILED until an operator replays or skips it (card 3.8a, ADR-115). */
  status: EventDeadLetterStatus;
  /** Set when the handler is ORDERED and the event is keyed: its stream waits behind this row. */
  orderingKey: string | null;
  streamSequence: number | null;
  attempts: number;
  /** Error class and code only. */
  lastError: string;
  failedAt: Date;
  resolvedAt: Date | null;
  /** When the worker queued a replayed job again; null while the replay waits for it. */
  requeuedAt: Date | null;
  resolvedByPlatformOperatorId: string | null;
  /** Why an operator skipped it; absent for a replay. */
  resolutionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const eventDeadLetterSchema = new Schema<EventDeadLetterDocument>(
  {
    ...domainIdField("eventDeadLetterId"),
    eventId: { type: String, required: true },
    handlerKey: { type: String, required: true },
    type: { type: String, required: true },
    organizationId: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(EVENT_DEAD_LETTER_STATUS),
      default: EVENT_DEAD_LETTER_STATUS.FAILED,
    },
    orderingKey: { type: String, default: null },
    streamSequence: { type: Number, default: null },
    attempts: { type: Number, required: true },
    lastError: { type: String, required: true },
    failedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    requeuedAt: { type: Date, default: null },
    resolvedByPlatformOperatorId: { type: String, default: null },
    resolutionReason: { type: String, default: null },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

eventDeadLetterSchema.index({ eventDeadLetterId: 1 }, { unique: true });
// One row per handler and event, so a repeated final failure never writes a second one.
eventDeadLetterSchema.index({ eventId: 1, handlerKey: 1 }, { unique: true });
eventDeadLetterSchema.index({ failedAt: -1 });
// The platform list: by status, newest first.
eventDeadLetterSchema.index({ status: 1, failedAt: -1 });
// The worker's replayer looks for replays that are not queued yet.
eventDeadLetterSchema.index({ status: 1, requeuedAt: 1 });

export function registerEventDeadLetterModel(): void {
  registerModel({
    modelName: EVENT_DEAD_LETTER_MODEL_NAME,
    collectionName: EVENT_DEAD_LETTER_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: eventDeadLetterSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
