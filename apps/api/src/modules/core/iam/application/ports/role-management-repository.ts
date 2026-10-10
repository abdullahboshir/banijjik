import type { RoleId } from "@banijjik/ids";
import type { Role } from "../../domain/role.entity.js";

export interface RolePageRequest {
  readonly page: number;
  readonly limit: number;
}

export interface RolePage {
  readonly roles: readonly Role[];
  readonly hasNext: boolean;
}

/**
 * Reads and writes of roles for the role endpoints and the permission gate. Every method runs in
 * the active organization context (the tenant plugin scopes it), so a role of another
 * organization is never returned.
 */
export interface RoleManagementRepository {
  /** Throws DuplicateRoleNameError when another ACTIVE role has the name. Joins the unit of work. */
  insert(role: Role): Promise<void>;
  findById(roleId: RoleId): Promise<Role | undefined>;
  /** One query for any number of roles; unknown IDs are absent. */
  findByIds(roleIds: readonly RoleId[]): Promise<readonly Role[]>;
  /** System roles first (in creation order), then custom roles by name. */
  list(request: RolePageRequest): Promise<RolePage>;
  /**
   * Saves name, permission keys and status of `role` if the stored version is still
   * `expectedVersion`, and returns the saved role (version + 1). A stale version is a 409.
   * Throws DuplicateRoleNameError on a name clash.
   */
  update(role: Role, expectedVersion: number): Promise<Role>;
}
