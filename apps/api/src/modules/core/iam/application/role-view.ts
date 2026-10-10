import type { Role } from "../domain/role.entity.js";
import type { PermissionResolver } from "./permission-resolver.js";

/** A role together with the permission keys it effectively grants right now. */
export interface RoleView {
  readonly role: Role;
  readonly permissionKeys: readonly string[];
}

export function toRoleView(role: Role, resolver: PermissionResolver): RoleView {
  return { role, permissionKeys: [...resolver.effectiveKeysOf(role)].sort() };
}
