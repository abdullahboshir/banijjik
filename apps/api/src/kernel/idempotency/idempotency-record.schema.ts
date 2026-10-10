import {
  DATABASE_KIND,
  IDEMPOTENCY_SCOPE_KIND,
  IDEMPOTENCY_STATUS,
  MODEL_TENANCY,
  type IdempotencyScopeKind,
  type IdempotencyStatus,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, registerModel, SCHEMA_OPTIONS } from "../db/index.js";

export const IDEMPOTENCY_RECORD_MODEL_NAME = "IdempotencyRecord";
export const IDEMPOTENCY_RECORD_COLLECTION_NAME = "idempotency_records";

export interface IdempotencyRecordDocument {
  idempotencyRecordId: string;
  scopeKind: IdempotencyScopeKind;
  /** The organizationId or userId the key belongs to, so a key never collides across them. */
  scopeId: string;
  idempotencyKey: string;
  /** SHA-256 over method, route pattern, validated params and canonical body. */
  requestHash: string;
  status: IdempotencyStatus;
  /** An IN_PROGRESS record can be taken over once this time has passed (a crashed request). */
  lockedUntil: Date;
  responseStatus?: number;
  /** The success response body as a JSON string, so any key name is stored safely. */
  responseBody?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const idempotencyRecordSchema = new Schema<IdempotencyRecordDocument>(
  {
    ...domainIdField("idempotencyRecordId"),
    scopeKind: { type: String, required: true, enum: Object.values(IDEMPOTENCY_SCOPE_KIND) },
    scopeId: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(IDEMPOTENCY_STATUS) },
    lockedUntil: { type: Date, required: true },
    responseStatus: { type: Number },
    responseBody: { type: String },
    expiresAt: { type: Date, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// The unique index is the claim: of two concurrent inserts exactly one wins.
idempotencyRecordSchema.index({ scopeKind: 1, scopeId: 1, idempotencyKey: 1 }, { unique: true });
idempotencyRecordSchema.index({ idempotencyRecordId: 1 }, { unique: true });
// MongoDB removes a record 24 hours after it was claimed.
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Tenancy NONE on purpose: the record spans user and organization scopes and is reached only by
 * this folder's store, always with an explicit scope filter.
 */
export function registerIdempotencyModel(): void {
  registerModel({
    modelName: IDEMPOTENCY_RECORD_MODEL_NAME,
    collectionName: IDEMPOTENCY_RECORD_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: idempotencyRecordSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
