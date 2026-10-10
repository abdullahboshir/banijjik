import { stripMongoInternals } from "../../../../kernel/db/index.js";
import type { PlatformAuditLog } from "../domain/platform-audit-log.entity.js";
import type { PlatformAuditLogDocument } from "./platform-audit-log.schema.js";

export function toPlatformAuditLogDocument(log: PlatformAuditLog): PlatformAuditLogDocument {
  return {
    platformAuditLogId: log.platformAuditLogId,
    actorPlatformOperatorId: log.actorPlatformOperatorId,
    actorUserId: log.actorUserId,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    ...(log.organizationId === undefined ? {} : { organizationId: log.organizationId }),
    changes: log.changes,
    ...(log.reason === undefined ? {} : { reason: log.reason }),
    requestId: log.requestId,
    occurredAt: log.occurredAt,
    createdAt: log.occurredAt,
    updatedAt: log.occurredAt,
    createdByUserId: log.actorUserId,
    updatedByUserId: null,
  };
}

export function toPlatformAuditLog(document: PlatformAuditLogDocument): PlatformAuditLog {
  const stored = stripMongoInternals(document);
  return {
    platformAuditLogId: stored.platformAuditLogId,
    actorPlatformOperatorId: stored.actorPlatformOperatorId,
    actorUserId: stored.actorUserId,
    action: stored.action,
    targetType: stored.targetType,
    targetId: stored.targetId,
    ...(stored.organizationId === undefined ? {} : { organizationId: stored.organizationId }),
    changes: stored.changes,
    ...(stored.reason === undefined ? {} : { reason: stored.reason }),
    requestId: stored.requestId,
    occurredAt: stored.occurredAt,
  };
}
