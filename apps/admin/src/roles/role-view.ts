import {
  PERMISSION_KEY,
  ROLE_STATUS,
  type CallerPermissionsResponse,
  type PermissionDefinitionResponse,
  type RoleSummary,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { holdsPermission } from "../shell/permissions";
import { roleLabelOf } from "../staff/assignment-options";
import { groupPermissions, type PermissionGroup } from "./permission-groups";
import type { RoleAction } from "./role-actions";
import type { RoleRowView } from "./role-list";

const STATUS_LABEL_KEY: Record<RoleSummary["status"], string> = {
  [ROLE_STATUS.ACTIVE]: "roles.status.active",
  [ROLE_STATUS.ARCHIVED]: "roles.status.archived",
};

/** System roles first (they are the same for every business), then custom roles by name. */
export function sortRoles(roles: readonly RoleSummary[], t: Translator["t"]): RoleSummary[] {
  return [...roles].sort((left, right) => {
    if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
    return roleLabelOf(left, t).localeCompare(roleLabelOf(right, t));
  });
}

export function roleStatusLabel(status: RoleSummary["status"], t: Translator["t"]): string {
  return t(STATUS_LABEL_KEY[status]);
}

/**
 * Keys of the role that no effective module offers (its module is switched off). The edit form cannot
 * show them, so it sends them back unchanged instead of dropping them silently.
 */
export function preservedPermissionKeys(
  role: Pick<RoleSummary, "permissionKeys">,
  definitions: readonly PermissionDefinitionResponse[],
): string[] {
  const offered = new Set<string>(definitions.map((definition) => definition.permissionKey));
  return role.permissionKeys.filter((key) => !offered.has(key));
}

export function toRoleRows(roles: readonly RoleSummary[], t: Translator["t"]): RoleRowView[] {
  return sortRoles(roles, t).map((role) => ({
    roleId: role.roleId,
    name: roleLabelOf(role, t),
    isSystem: role.isSystem,
    membersText: t("roles.members", { count: role.memberCount }),
    status: role.status,
    statusLabel: roleStatusLabel(role.status, t),
  }));
}

/** Permissions the caller holds at every location: the only ones the caller may hand to a role. */
export function heldPermissionKeys(permissions: CallerPermissionsResponse): ReadonlySet<string> {
  return new Set(permissions.allLocations);
}

export function roleGroupsOf(input: {
  definitions: readonly PermissionDefinitionResponse[];
  permissions: CallerPermissionsResponse;
  role: Pick<RoleSummary, "permissionKeys"> | undefined;
  mode: "offer" | "show";
  translator: Pick<Translator, "t" | "has">;
}): PermissionGroup[] {
  return groupPermissions({
    definitions: input.definitions,
    heldKeys: heldPermissionKeys(input.permissions),
    selectedKeys: new Set(input.role?.permissionKeys ?? []),
    mode: input.mode,
    t: input.translator.t,
    hasText: input.translator.has,
  });
}

/** System roles and archived roles are read-only; the rest depends on the permission and the access mode. */
export function roleActionsFor(input: {
  role: Pick<RoleSummary, "isSystem" | "status">;
  permissions: CallerPermissionsResponse;
  canWrite: boolean;
}): RoleAction[] {
  const { role, permissions, canWrite } = input;
  if (!canWrite || role.isSystem || role.status !== ROLE_STATUS.ACTIVE) return [];
  const actions: RoleAction[] = [];
  if (holdsPermission(permissions, PERMISSION_KEY.IAM_ROLE_UPDATE)) actions.push("edit");
  if (holdsPermission(permissions, PERMISSION_KEY.IAM_ROLE_ARCHIVE)) actions.push("archive");
  return actions;
}
