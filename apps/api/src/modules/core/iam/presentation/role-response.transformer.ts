import type { RoleResponse, RoleSummary } from "@banijjik/contracts";
import type { RoleView } from "../application/role-view.js";
import type { RoleListItem } from "../application/use-cases/list-roles.use-case.js";

function nameFields(view: RoleView): { nameKey?: string; name?: string } {
  const { nameKey, name } = view.role;
  return {
    ...(nameKey === null ? {} : { nameKey }),
    ...(name === null ? {} : { name }),
  };
}

export function toRoleResponse(view: RoleView): RoleResponse {
  const { role } = view;
  return {
    roleId: role.roleId,
    roleKey: role.roleKey,
    ...nameFields(view),
    isSystem: role.isSystem,
    status: role.status,
    permissionKeys: [...view.permissionKeys],
    version: role.version,
  };
}

export function toRoleSummary(item: RoleListItem): RoleSummary {
  return { ...toRoleResponse(item), memberCount: item.memberCount };
}
