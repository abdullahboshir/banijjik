import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const PROCESSED_EVENT_MODEL_NAME = "ProcessedEvent";
export const PROCESSED_EVENT_COLLECTION_NAME = "processed_events";

/**
 * "This handler has done this event": written in the handler's own transaction, so the marker
 * exists exactly when the handler's writes do (ADR-090).
 */
export interface ProcessedEventDocument {
  processedEventId: string;
  eventId: string;
  handlerKey: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const processedEventSchema = new Schema<ProcessedEventDocument>(
  {
    ...domainIdField("processedEventId"),
    eventId: { type: String, required: true },
    handlerKey: { type: String, required: true },
    processedAt: { type: Date, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

processedEventSchema.index({ processedEventId: 1 }, { unique: true });
// One marker per handler and event: this is what makes a second delivery a no-op.
processedEventSchema.index({ eventId: 1, handlerKey: 1 }, { unique: true });

export function registerProcessedEventModel(): void {
  registerModel({
    modelName: PROCESSED_EVENT_MODEL_NAME,
    collectionName: PROCESSED_EVENT_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: processedEventSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
