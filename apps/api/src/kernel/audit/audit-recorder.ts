import type { AuditAction, AuditChanges, AuditEntityType } from "@banijjik/contracts";

/** What a use case says about a business change. Who, where and when come from the request context. */
export interface AuditEntry {
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** Safe fields only: never a password hash, token or secret (see the audit module README). */
  readonly changes?: AuditChanges;
}

/**
 * The kernel port every module uses to write its audit entries (ADR-089). The audit module
 * implements it. `record` must run inside `withTransaction`, so an entry exists exactly when its
 * change does; without a transaction it throws. The organization, actor, member, request id and
 * system reason come from the request context, never from the caller.
 */
export interface AuditRecorder {
  record(entry: AuditEntry): Promise<void>;
}
