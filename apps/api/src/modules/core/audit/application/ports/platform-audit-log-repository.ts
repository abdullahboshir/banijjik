import type { PlatformAuditTargetType } from "@banijjik/contracts";
import type { PlatformAuditLog } from "../../domain/platform-audit-log.entity.js";

export interface PlatformAuditLogQuery {
  readonly page: number;
  readonly limit: number;
  readonly targetType?: PlatformAuditTargetType | undefined;
  readonly organizationId?: string | undefined;
  readonly actorPlatformOperatorId?: string | undefined;
  /** Inclusive lower bound of `occurredAt`. */
  readonly from?: Date | undefined;
  /** Inclusive upper bound of `occurredAt`. */
  readonly to?: Date | undefined;
}

export interface PlatformAuditLogPage {
  readonly items: readonly PlatformAuditLog[];
  readonly hasNext: boolean;
}

/** Reads only: entries are written through the kernel `PlatformAuditRecorder`, inside the change's transaction. */
export interface PlatformAuditLogRepository {
  list(query: PlatformAuditLogQuery): Promise<PlatformAuditLogPage>;
}
