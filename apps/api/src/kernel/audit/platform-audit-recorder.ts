import type {
  AuditChanges,
  PlatformAuditAction,
  PlatformAuditTargetType,
} from "@banijjik/contracts";

/** What a platform use case says about an operator action. Who, when and the request come from the context. */
export interface PlatformAuditEntry {
  readonly action: PlatformAuditAction;
  readonly targetType: PlatformAuditTargetType;
  readonly targetId: string;
  /** The tenant the action concerns, when there is one. */
  readonly organizationId?: string;
  /** Safe fields only: never a secret (see the audit module README). */
  readonly changes?: AuditChanges;
  readonly reason?: string;
}

/**
 * The kernel port every platform use case uses to write its audit entry (ADR-093). The audit
 * module implements it. Like `AuditRecorder`, `record` must run inside `withTransaction`, so an
 * entry exists exactly when its change does; without a transaction it throws. The operator, the
 * user and the request id come from the request context, never from the caller.
 */
export interface PlatformAuditRecorder {
  record(entry: PlatformAuditEntry): Promise<void>;
}
