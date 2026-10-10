import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const EVENT_DEAD_LETTER_MODEL_NAME = "EventDeadLetter";
export const EVENT_DEAD_LETTER_COLLECTION_NAME = "event_dead_letters";

/** A handler that failed its last attempt. The event's other handlers are not affected. */
export interface EventDeadLetterDocument {
  eventDeadLetterId: string;
  eventId: string;
  handlerKey: string;
  type: string;
  attempts: number;
  /** Error class and code only. */
  lastError: string;
  failedAt: Date;
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
    attempts: { type: Number, required: true },
    lastError: { type: String, required: true },
    failedAt: { type: Date, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

eventDeadLetterSchema.index({ eventDeadLetterId: 1 }, { unique: true });
// One row per handler and event, so a repeated final failure never writes a second one.
eventDeadLetterSchema.index({ eventId: 1, handlerKey: 1 }, { unique: true });
eventDeadLetterSchema.index({ failedAt: -1 });

export function registerEventDeadLetterModel(): void {
  registerModel({
    modelName: EVENT_DEAD_LETTER_MODEL_NAME,
    collectionName: EVENT_DEAD_LETTER_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: eventDeadLetterSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
