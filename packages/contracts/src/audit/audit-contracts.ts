import type { AuditAction, AuditEntityType } from "./audit-action.js";

/** A value an audit entry may record. Secrets, password hashes and tokens never go here. */
export type AuditValue = string | number | boolean | null | readonly string[];

/** Per changed field, the value before and after. A create has only `to`; a field that was emptied has `to: null`. */
export type AuditChanges = Readonly<Record<string, { from?: AuditValue; to?: AuditValue }>>;

/** One row of `GET /orgs/{organizationId}/audit-logs` (14-API.md section 5.1). */
export interface AuditLogSummary {
  auditLogId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actorUserId?: string;
  actorMemberId?: string;
  changes: AuditChanges;
  requestId: string;
  systemReason?: string;
  occurredAt: string;
}
