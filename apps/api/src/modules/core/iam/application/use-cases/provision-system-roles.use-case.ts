import { SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import type { OrganizationId, RoleId, UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { Role } from "../../domain/role.entity.js";
import type { RoleRepository } from "../ports/role-repository.js";

export interface ProvisionSystemRolesInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export interface ProvisionSystemRolesResult {
  readonly ownerRoleId: RoleId;
}

export interface ProvisionSystemRolesDependencies {
  readonly roles: RoleRepository;
  readonly clock: Clock;
}

/**
 * Creates the six system roles of a new organization. It writes through the surrounding unit of
 * work, so the caller (organization creation) decides what commits together with the roles.
 */
export class ProvisionSystemRolesUseCase {
  constructor(private readonly dependencies: ProvisionSystemRolesDependencies) {}

  async execute(input: ProvisionSystemRolesInput): Promise<ProvisionSystemRolesResult> {
    const now = this.dependencies.clock.now();
    const createRole = (roleKey: SystemRoleKey): Role =>
      Role.createSystem({
        organizationId: input.organizationId,
        roleKey,
        createdByUserId: input.actorUserId,
        now,
      });
    const ownerRole = createRole(SYSTEM_ROLE_KEY.OWNER);
    const otherRoles = Object.values(SYSTEM_ROLE_KEY)
      .filter((roleKey) => roleKey !== SYSTEM_ROLE_KEY.OWNER)
      .map(createRole);
    await this.dependencies.roles.insertMany([ownerRole, ...otherRoles]);
    return { ownerRoleId: ownerRole.roleId };
  }
}
