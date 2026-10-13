import {
  PLATFORM_PERMISSION_KEY,
  PLATFORM_ROLE,
  USER_STATUS,
  type PlatformPermissionKey,
  type PlatformRole,
} from "@banijjik/contracts";
import { holdsPermission } from "../auth/permissions";
import type { Labels } from "../lib/labels";

export type OperatorActionKind = "changeRoles" | "disable" | "enable";

export type OperatorListStatus = typeof USER_STATUS.ACTIVE | typeof USER_STATUS.DISABLED;

/** The three platform roles, in the order the form shows them. */
export const OPERATOR_ROLE_ORDER: readonly PlatformRole[] = [
  PLATFORM_ROLE.SUPER_ADMIN,
  PLATFORM_ROLE.SUPPORT,
  PLATFORM_ROLE.BILLING,
];

export const OPERATOR_ROLE_LABEL_KEY = {
  [PLATFORM_ROLE.SUPER_ADMIN]: "platform.role.SUPER_ADMIN",
  [PLATFORM_ROLE.SUPPORT]: "platform.role.SUPPORT",
  [PLATFORM_ROLE.BILLING]: "platform.role.BILLING",
} as const;

/** Text of the operator list, its buttons and its sheets. */
export const OPERATOR_LABEL_KEYS = [
  "platform.operators.title",
  "platform.operators.empty",
  "platform.operators.you",
  "platform.operators.column.name",
  "platform.operators.column.identifier",
  "platform.operators.column.roles",
  "platform.operators.column.status",
  "platform.operators.column.actions",
  "platform.role.SUPER_ADMIN",
  "platform.role.SUPPORT",
  "platform.role.BILLING",
  "platform.status.operator.ACTIVE",
  "platform.status.operator.DISABLED",
  "platform.action.addOperator",
  "platform.action.changeRoles",
  "platform.action.disableOperator",
  "platform.action.enableOperator",
  "platform.sheet.addOperator.title",
  "platform.sheet.addOperator.description",
  "platform.sheet.addOperator.success",
  "platform.sheet.changeRoles.title",
  "platform.sheet.changeRoles.description",
  "platform.sheet.changeRoles.success",
  "platform.sheet.disableOperator.title",
  "platform.sheet.disableOperator.description",
  "platform.sheet.disableOperator.success",
  "platform.sheet.enableOperator.title",
  "platform.sheet.enableOperator.description",
  "platform.sheet.enableOperator.success",
  "platform.field.operatorIdentifier",
  "platform.field.operatorIdentifierHint",
  "platform.field.operatorRoles",
  "platform.field.operatorRolesHint",
  "platform.field.reason",
  "platform.field.reasonHint",
] as const;

export type OperatorLabels = Labels<(typeof OPERATOR_LABEL_KEYS)[number]>;

export interface OperatorActionRow {
  platformOperatorId: string;
  status: OperatorListStatus;
}

export interface OperatorViewer {
  platformOperatorId: string;
  permissions: readonly PlatformPermissionKey[];
}

/**
 * Actions for one row: none on the caller's own row, and none without write permission.
 * The API refuses both again (`OWN_OPERATOR_ACCESS`, permission middleware).
 */
export function operatorActionsFor(
  row: OperatorActionRow,
  viewer: OperatorViewer,
): OperatorActionKind[] {
  const canWrite = holdsPermission(viewer, PLATFORM_PERMISSION_KEY.OPERATOR_WRITE);
  if (!canWrite || row.platformOperatorId === viewer.platformOperatorId) return [];
  if (row.status === USER_STATUS.ACTIVE) return ["changeRoles", "disable"];
  return ["changeRoles", "enable"];
}
