import { ERROR_CODE } from "@banijjik/contracts";
import type { PlatformAuditEntry, PlatformAuditRecorder } from "../../../../kernel/audit/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { getActiveSession, models } from "../../../../kernel/db/index.js";
import { AppError, unauthenticated } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { createPlatformAuditLog } from "../domain/platform-audit-log.entity.js";
import { toPlatformAuditLogDocument } from "./platform-audit-log.mapper.js";
import {
  PLATFORM_AUDIT_LOG_MODEL_NAME,
  type PlatformAuditLogDocument,
} from "./platform-audit-log.schema.js";

/**
 * Writes an operator's audit entry through the transaction of the change it describes (ADR-093).
 * The operator, the user and the request id are read from the request context: a caller cannot
 * name them, so an entry cannot be attributed to another operator.
 */
export class MongoPlatformAuditRecorder implements PlatformAuditRecorder {
  constructor(private readonly clock: Clock) {}

  async record(entry: PlatformAuditEntry): Promise<void> {
    const session = getActiveSession();
    if (session === undefined) {
      throw new AppError({
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.audit_needs_transaction",
      });
    }
    const { platformOperatorId, userId, requestId } = getRequestContext();
    if (platformOperatorId === undefined || userId === undefined) throw unauthenticated();
    const log = createPlatformAuditLog({
      actorPlatformOperatorId: platformOperatorId,
      actorUserId: userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ...(entry.organizationId === undefined ? {} : { organizationId: entry.organizationId }),
      ...(entry.changes === undefined ? {} : { changes: entry.changes }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      requestId,
      occurredAt: this.clock.now(),
    });
    await models({})
      .get<PlatformAuditLogDocument>(PLATFORM_AUDIT_LOG_MODEL_NAME)
      .create([toPlatformAuditLogDocument(log)], { session });
  }
}
