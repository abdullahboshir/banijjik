import type { OrganizationId, RoleId } from "@banijjik/ids";
import type { Role } from "../../domain/role.entity.js";

export interface RoleRepository {
  /** Inserts all roles; joins the surrounding unit of work. */
  insertMany(roles: readonly Role[]): Promise<void>;
  /**
   * The role key of each requested role, in one query. Both lists are filters, so a role of
   * another organization is never returned. Roles that do not exist are simply absent.
   */
  findRoleKeysByIds(
    organizationIds: readonly OrganizationId[],
    roleIds: readonly RoleId[],
  ): Promise<ReadonlyMap<RoleId, string>>;
}
