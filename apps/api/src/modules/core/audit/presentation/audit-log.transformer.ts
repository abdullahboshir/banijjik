import type { AuditLogSummary } from "@banijjik/contracts";
import type { AuditLog } from "../domain/audit-log.entity.js";

/** The list row of 14-API.md section 5.1. The organization ID is the path's, so it is not repeated. */
export function toAuditLogSummary(log: AuditLog): AuditLogSummary {
  return {
    auditLogId: log.auditLogId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    ...(log.actorUserId === undefined ? {} : { actorUserId: log.actorUserId }),
    ...(log.actorMemberId === undefined ? {} : { actorMemberId: log.actorMemberId }),
    changes: log.changes,
    requestId: log.requestId,
    ...(log.systemReason === undefined ? {} : { systemReason: log.systemReason }),
    occurredAt: log.occurredAt.toISOString(),
  };
}
