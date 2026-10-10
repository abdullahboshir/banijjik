import {
  PLATFORM_AUDIT_TARGET_TYPE,
  type AuditChanges,
  type PlatformAuditAction,
  type PlatformAuditTargetType,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const PLATFORM_AUDIT_LOG_MODEL_NAME = "PlatformAuditLog";
export const PLATFORM_AUDIT_LOG_COLLECTION_NAME = "platform_audit_logs";

export interface PlatformAuditLogDocument {
  platformAuditLogId: string;
  actorPlatformOperatorId: string;
  actorUserId: string;
  action: PlatformAuditAction;
  targetType: PlatformAuditTargetType;
  targetId: string;
  /** The tenant the action concerns. Not the tenant filter: the model has tenancy NONE. */
  organizationId?: string;
  changes: AuditChanges;
  reason?: string;
  requestId: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const platformAuditLogSchema = new Schema<PlatformAuditLogDocument>(
  {
    ...domainIdField("platformAuditLogId"),
    actorPlatformOperatorId: { type: String, required: true },
    actorUserId: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true, enum: Object.values(PLATFORM_AUDIT_TARGET_TYPE) },
    targetId: { type: String, required: true },
    organizationId: { type: String },
    changes: { type: Schema.Types.Mixed, required: true, default: {} },
    reason: { type: String },
    requestId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    ...auditFields,
  },
  // minimize off: an entry without changes keeps its empty object instead of losing the field.
  { ...SCHEMA_OPTIONS, minimize: false },
);

platformAuditLogSchema.index({ platformAuditLogId: 1 }, { unique: true });
// Backs the default list, newest first.
platformAuditLogSchema.index({ occurredAt: -1, platformAuditLogId: -1 });
// Backs "what happened to this tenant" and "what did this operator do".
platformAuditLogSchema.index({ organizationId: 1, occurredAt: -1 });
platformAuditLogSchema.index({ actorPlatformOperatorId: 1, occurredAt: -1 });
platformAuditLogSchema.index({ targetType: 1, occurredAt: -1 });
