import type { PermissionResolver } from "../permission-resolver.js";
import type { MemberAccessReader } from "../ports/member-access-reader.js";
import type {
  RoleManagementRepository,
  RolePageRequest,
} from "../ports/role-management-repository.js";
import { toRoleView, type RoleView } from "../role-view.js";

export interface RoleListItem extends RoleView {
  readonly memberCount: number;
}

export interface RoleListResult {
  readonly items: readonly RoleListItem[];
  readonly hasNext: boolean;
}

export interface ListRolesDependencies {
  readonly roles: RoleManagementRepository;
  readonly members: Pick<MemberAccessReader, "countActiveMembersByRole">;
  readonly resolver: PermissionResolver;
}

/** One page of roles, system roles first, with the effective keys and the member count of each. */
export class ListRolesUseCase {
  constructor(private readonly dependencies: ListRolesDependencies) {}

  async execute(request: RolePageRequest): Promise<RoleListResult> {
    const { roles, members, resolver } = this.dependencies;
    const page = await roles.list(request);
    // One aggregate for the whole page, not one count per role.
    const counts = await members.countActiveMembersByRole(page.roles.map((role) => role.roleId));
    const items = page.roles.map((role) => ({
      ...toRoleView(role, resolver),
      memberCount: counts.get(role.roleId) ?? 0,
    }));
    return { items, hasNext: page.hasNext };
  }
}
