import type {
  AuditChanges,
  PlatformAuditAction,
  PlatformAuditTargetType,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";

/** One immutable fact about an operator action (09 section 5.8, platform-database copy). Never edited. */
export interface PlatformAuditLog {
  readonly platformAuditLogId: string;
  readonly actorPlatformOperatorId: string;
  readonly actorUserId: string;
  readonly action: PlatformAuditAction;
  readonly targetType: PlatformAuditTargetType;
  readonly targetId: string;
  readonly organizationId?: string;
  readonly changes: AuditChanges;
  readonly reason?: string;
  readonly requestId: string;
  readonly occurredAt: Date;
}

export type NewPlatformAuditLogInput = Omit<PlatformAuditLog, "platformAuditLogId" | "changes"> & {
  readonly changes?: AuditChanges;
};

export function createPlatformAuditLog(input: NewPlatformAuditLogInput): PlatformAuditLog {
  return { ...input, platformAuditLogId: newId(), changes: input.changes ?? {} };
}
