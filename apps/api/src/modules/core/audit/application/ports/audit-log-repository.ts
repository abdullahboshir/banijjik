import type { AuditEntityType } from "@banijjik/contracts";
import type { AuditLog } from "../../domain/audit-log.entity.js";

export interface AuditLogQuery {
  readonly page: number;
  readonly limit: number;
  readonly entityType?: AuditEntityType | undefined;
  readonly entityId?: string | undefined;
  readonly actorUserId?: string | undefined;
  /** Inclusive lower bound of `occurredAt`. */
  readonly from?: Date | undefined;
  /** Inclusive upper bound of `occurredAt`. */
  readonly to?: Date | undefined;
}

export interface AuditLogPage {
  readonly items: readonly AuditLog[];
  readonly hasNext: boolean;
}

/** Reads only: entries are written through the kernel `AuditRecorder`, inside the change's transaction. */
export interface AuditLogRepository {
  list(query: AuditLogQuery): Promise<AuditLogPage>;
}
