import type { AuditAction, AuditChanges, AuditEntityType } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const AUDIT_LOG_MODEL_NAME = "AuditLog";
export const AUDIT_LOG_COLLECTION_NAME = "audit_logs";

export interface AuditLogDocument {
  auditLogId: string;
  organizationId: string;
  actorUserId?: string;
  actorMemberId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  changes: AuditChanges;
  requestId: string;
  systemReason?: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const auditLogSchema = new Schema<AuditLogDocument>(
  {
    ...domainIdField("auditLogId"),
    organizationId: { type: String, required: true, immutable: true },
    actorUserId: { type: String },
    actorMemberId: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    changes: { type: Schema.Types.Mixed, required: true, default: {} },
    requestId: { type: String, required: true },
    systemReason: { type: String },
    occurredAt: { type: Date, required: true },
    ...auditFields,
  },
  // minimize off: an entry without changes keeps its empty object instead of losing the field.
  { ...SCHEMA_OPTIONS, minimize: false },
);

auditLogSchema.index({ organizationId: 1, auditLogId: 1 }, { unique: true });
// Backs the default list, newest first.
auditLogSchema.index({ organizationId: 1, occurredAt: -1, auditLogId: -1 });
// Backs "history of one record".
auditLogSchema.index({ organizationId: 1, entityType: 1, entityId: 1, occurredAt: -1 });
// Backs "what did this person do".
auditLogSchema.index({ organizationId: 1, actorUserId: 1, occurredAt: -1 });
