import { DATABASE_KIND, SEQUENCE_KEY, type SequenceKey } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const SEQUENCE_MODEL_NAME = "Sequence";
export const SEQUENCE_COLLECTION_NAME = "sequences";

/** `nextValue` is the last number handed out; the first call returns 1. */
export interface SequenceDocument {
  sequenceId: string;
  organizationId: string;
  sequenceKey: SequenceKey;
  nextValue: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const sequenceSchema = new Schema<SequenceDocument>(
  {
    ...domainIdField("sequenceId"),
    organizationId: { type: String, required: true },
    sequenceKey: { type: String, required: true, enum: Object.values(SEQUENCE_KEY) },
    nextValue: { type: Number, required: true, default: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// One counter per organization and key; the unique index is what makes concurrent upserts safe.
sequenceSchema.index({ organizationId: 1, sequenceKey: 1 }, { unique: true });
sequenceSchema.index({ sequenceId: 1 }, { unique: true });

/** Startup calls this once, next to the modules' own model registration. */
export function registerSequenceModel(): void {
  registerModel({
    modelName: SEQUENCE_MODEL_NAME,
    collectionName: SEQUENCE_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: sequenceSchema,
  });
}
