import { stripMongoInternals } from "../../../../kernel/db/index.js";
import type { AuditLog } from "../domain/audit-log.entity.js";
import type { AuditLogDocument } from "./audit-log.schema.js";

export function toAuditLogDocument(log: AuditLog): AuditLogDocument {
  return {
    auditLogId: log.auditLogId,
    organizationId: log.organizationId,
    ...(log.actorUserId === undefined ? {} : { actorUserId: log.actorUserId }),
    ...(log.actorMemberId === undefined ? {} : { actorMemberId: log.actorMemberId }),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    changes: log.changes,
    requestId: log.requestId,
    ...(log.systemReason === undefined ? {} : { systemReason: log.systemReason }),
    occurredAt: log.occurredAt,
    createdAt: log.occurredAt,
    updatedAt: log.occurredAt,
    createdByUserId: log.actorUserId ?? null,
    updatedByUserId: null,
  };
}

export function toAuditLog(document: AuditLogDocument): AuditLog {
  const stored = stripMongoInternals(document);
  return {
    auditLogId: stored.auditLogId,
    organizationId: stored.organizationId,
    ...(stored.actorUserId === undefined ? {} : { actorUserId: stored.actorUserId }),
    ...(stored.actorMemberId === undefined ? {} : { actorMemberId: stored.actorMemberId }),
    action: stored.action,
    entityType: stored.entityType,
    entityId: stored.entityId,
    changes: stored.changes,
    requestId: stored.requestId,
    ...(stored.systemReason === undefined ? {} : { systemReason: stored.systemReason }),
    occurredAt: stored.occurredAt,
  };
}
