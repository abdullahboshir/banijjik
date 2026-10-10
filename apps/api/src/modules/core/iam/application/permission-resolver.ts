import { ROLE_STATUS } from "@banijjik/contracts";
import { buildGrantMap, type GrantMap, type RoleAssignment } from "../domain/grant-map.js";
import type { Role } from "../domain/role.entity.js";
import { isSystemRoleKey } from "../domain/system-role-grants.js";
import type { PermissionCatalog } from "./permission-catalog.js";

/** Turns assignments and roles into what a member may do where (09 section 4.4). */
export class PermissionResolver {
  constructor(private readonly catalog: PermissionCatalog) {}

  /**
   * System roles get their keys from the code template, custom roles from their stored list
   * (keys the catalogue no longer knows are ignored). An archived role grants nothing.
   */
  effectiveKeysOf(role: Role): ReadonlySet<string> {
    if (role.status === ROLE_STATUS.ARCHIVED) return new Set();
    if (role.isSystem) {
      return isSystemRoleKey(role.roleKey) ? this.catalog.grantsOf(role.roleKey) : new Set();
    }
    return new Set(role.permissionKeys.filter((key) => this.catalog.has(key)));
  }

  resolve(assignments: readonly RoleAssignment[], roles: readonly Role[]): GrantMap {
    const keysByRoleId = new Map<string, ReadonlySet<string>>(
      roles.map((role) => [role.roleId, this.effectiveKeysOf(role)]),
    );
    return buildGrantMap(assignments, (roleId) => keysByRoleId.get(roleId) ?? new Set());
  }
}
