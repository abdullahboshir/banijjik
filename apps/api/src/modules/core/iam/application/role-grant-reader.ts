import { ROLE_STATUS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { RoleId } from "@banijjik/ids";
import type { PermissionResolver } from "./permission-resolver.js";
import type { RoleManagementRepository } from "./ports/role-management-repository.js";

/** What another module may know about a role before it hands the role to someone. */
export interface RoleGrantInfo {
  readonly roleId: RoleId;
  readonly isActive: boolean;
  /** The OWNER system role. */
  readonly isOwnerRole: boolean;
  /** The keys the role grants right now; empty for an archived role. */
  readonly permissionKeys: ReadonlySet<string>;
}

export interface RoleGrantReader {
  /** One query for any number of roles of the active organization; unknown IDs are absent. */
  findGrants(roleIds: readonly RoleId[]): Promise<ReadonlyMap<RoleId, RoleGrantInfo>>;
}

export interface RoleGrantReaderDependencies {
  readonly roles: Pick<RoleManagementRepository, "findByIds">;
  readonly resolver: PermissionResolver;
}

/** Answers "may this role be given, and what does it grant?" for the member and invitation endpoints (ADR-092). */
export class IamRoleGrantReader implements RoleGrantReader {
  constructor(private readonly dependencies: RoleGrantReaderDependencies) {}

  async findGrants(roleIds: readonly RoleId[]): Promise<ReadonlyMap<RoleId, RoleGrantInfo>> {
    const { roles, resolver } = this.dependencies;
    const found = await roles.findByIds([...new Set(roleIds)]);
    return new Map(
      found.map((role) => [
        role.roleId,
        {
          roleId: role.roleId,
          isActive: role.status === ROLE_STATUS.ACTIVE,
          isOwnerRole: role.isSystem && role.roleKey === SYSTEM_ROLE_KEY.OWNER,
          permissionKeys: resolver.effectiveKeysOf(role),
        },
      ]),
    );
  }
}
