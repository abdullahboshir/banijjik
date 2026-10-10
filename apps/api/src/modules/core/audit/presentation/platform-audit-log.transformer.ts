import type { PlatformAuditLogSummary } from "@banijjik/contracts";
import type { PlatformAuditLog } from "../domain/platform-audit-log.entity.js";

/** The list row of `GET /platform/audit-logs`. */
export function toPlatformAuditLogSummary(log: PlatformAuditLog): PlatformAuditLogSummary {
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
    occurredAt: log.occurredAt.toISOString(),
  };
}
