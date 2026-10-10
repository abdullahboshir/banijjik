import { ERROR_CODE } from "@banijjik/contracts";
import type { AuditEntry, AuditRecorder } from "../../../../kernel/audit/index.js";
import { getRequestContext, getSystemReason } from "../../../../kernel/context/index.js";
import { getActiveSession, models } from "../../../../kernel/db/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { createAuditLog } from "../domain/audit-log.entity.js";
import { toAuditLogDocument } from "./audit-log.mapper.js";
import { AUDIT_LOG_MODEL_NAME, type AuditLogDocument } from "./audit-log.schema.js";

function internalError(messageKey: string): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey });
}

/**
 * Writes an audit entry through the transaction of the change it describes (ADR-089). The
 * organization, actor, member, request id and system reason are read from the request context:
 * a caller cannot name them, so an entry cannot be attributed to someone else or to another
 * organization.
 */
export class MongoAuditRecorder implements AuditRecorder {
  constructor(private readonly clock: Clock) {}

  async record(entry: AuditEntry): Promise<void> {
    const session = getActiveSession();
    if (session === undefined) throw internalError("errors.audit_needs_transaction");
    const { organizationId, userId, memberId, requestId } = getRequestContext();
    if (organizationId === undefined) throw internalError("errors.missing_tenant_context");
    const systemReason = getSystemReason();
    const log = createAuditLog({
      organizationId,
      ...(userId === undefined ? {} : { actorUserId: userId }),
      ...(memberId === undefined ? {} : { actorMemberId: memberId }),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.changes === undefined ? {} : { changes: entry.changes }),
      requestId,
      ...(systemReason === undefined ? {} : { systemReason }),
      occurredAt: this.clock.now(),
    });
    await models({ organizationId })
      .get<AuditLogDocument>(AUDIT_LOG_MODEL_NAME)
      .create([toAuditLogDocument(log)], { session });
  }
}
