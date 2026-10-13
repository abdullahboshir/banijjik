import { defineEnum } from "../define-enum.js";
import type { AuditChanges } from "../audit/audit-contracts.js";

/** What an operator did, as `platform.<entity>.<pastTenseVerb>`. Add-only. */
export const PLATFORM_AUDIT_ACTION = {
  TENANT_SUSPENDED: "platform.tenant.suspended",
  TENANT_REACTIVATED: "platform.tenant.reactivated",
  PACKAGE_CREATED: "platform.package.created",
  PACKAGE_UPDATED: "platform.package.updated",
  PACKAGE_ARCHIVED: "platform.package.archived",
  MODULE_OVERRIDE_CREATED: "platform.moduleOverride.created",
  MODULE_OVERRIDE_DELETED: "platform.moduleOverride.deleted",
  SUBSCRIPTION_TRIAL_EXTENDED: "platform.subscription.trialExtended",
  SUBSCRIPTION_PACKAGE_CHANGED: "platform.subscription.packageChanged",
  OPERATOR_SEEDED: "platform.operator.seeded",
  OPERATOR_CREATED: "platform.operator.created",
  OPERATOR_ROLES_CHANGED: "platform.operator.rolesChanged",
  OPERATOR_DISABLED: "platform.operator.disabled",
  OPERATOR_ENABLED: "platform.operator.enabled",
} as const;

export type PlatformAuditAction =
  (typeof PLATFORM_AUDIT_ACTION)[keyof typeof PLATFORM_AUDIT_ACTION];

/** The kind of record a platform audit entry is about. */
export const PLATFORM_AUDIT_TARGET_TYPE = defineEnum([
  "organization",
  "package",
  "subscription",
  "module_override",
  "platform_operator",
]);
export type PlatformAuditTargetType =
  (typeof PLATFORM_AUDIT_TARGET_TYPE)[keyof typeof PLATFORM_AUDIT_TARGET_TYPE];

/** One row of `GET /platform/audit-logs`. */
export interface PlatformAuditLogSummary {
  platformAuditLogId: string;
  actorPlatformOperatorId: string;
  actorUserId: string;
  action: PlatformAuditAction;
  targetType: PlatformAuditTargetType;
  targetId: string;
  organizationId?: string;
  changes: AuditChanges;
  reason?: string;
  requestId: string;
  occurredAt: string;
}
