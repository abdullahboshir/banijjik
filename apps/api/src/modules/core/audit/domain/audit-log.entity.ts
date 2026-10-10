import type { AuditAction, AuditChanges, AuditEntityType } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";

/** One immutable fact: who changed what, when, in which request (09 section 5.8). Never edited. */
export interface AuditLog {
  readonly auditLogId: string;
  readonly organizationId: string;
  readonly actorUserId?: string;
  readonly actorMemberId?: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly changes: AuditChanges;
  readonly requestId: string;
  /** Set when the change was made by system code (a job, a seed), not by a signed-in member. */
  readonly systemReason?: string;
  readonly occurredAt: Date;
}

export type NewAuditLogInput = Omit<AuditLog, "auditLogId" | "changes"> & {
  readonly changes?: AuditChanges;
};

export function createAuditLog(input: NewAuditLogInput): AuditLog {
  return { ...input, auditLogId: newId(), changes: input.changes ?? {} };
}
