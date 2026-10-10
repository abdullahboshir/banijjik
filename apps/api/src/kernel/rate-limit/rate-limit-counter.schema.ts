import { DATABASE_KIND } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const RATE_LIMIT_COUNTER_MODEL_NAME = "RateLimitCounter";
export const RATE_LIMIT_COUNTER_COLLECTION_NAME = "rate_limit_counters";

export interface RateLimitCounterDocument {
  rateLimitCounterId: string;
  bucket: string;
  /** SHA-256 of bucket and key, so identifiers are not stored in clear. */
  keyHash: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const rateLimitCounterSchema = new Schema<RateLimitCounterDocument>(
  {
    ...domainIdField("rateLimitCounterId"),
    bucket: { type: String, required: true },
    keyHash: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// One counter per subject and window; the unique index makes the concurrent upsert safe.
rateLimitCounterSchema.index({ bucket: 1, keyHash: 1, windowStart: 1 }, { unique: true });
rateLimitCounterSchema.index({ rateLimitCounterId: 1 }, { unique: true });
// MongoDB removes a counter once its window is over.
rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Startup calls this once, next to registerSequenceModel(). */
export function registerRateLimitModel(): void {
  registerModel({
    modelName: RATE_LIMIT_COUNTER_MODEL_NAME,
    collectionName: RATE_LIMIT_COUNTER_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: rateLimitCounterSchema,
  });
}
