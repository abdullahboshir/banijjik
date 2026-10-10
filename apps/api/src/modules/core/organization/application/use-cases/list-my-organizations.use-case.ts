import type { OrganizationId, RoleId, UserId } from "@banijjik/ids";
import { MAX_ORGANIZATIONS_PER_USER_LISTING } from "../../domain/organization-limits.js";
import type { Member } from "../../domain/member.entity.js";
import type { Organization } from "../../domain/organization.entity.js";
import type { MyOrganization } from "../my-organization.js";
import type { RoleKeyLookup } from "../ports/iam-ports.js";
import type { MemberRepository, OrganizationRepository } from "../ports/repositories.js";

export interface ListMyOrganizationsDependencies {
  readonly members: MemberRepository;
  readonly organizations: OrganizationRepository;
  readonly roleKeys: RoleKeyLookup;
}

function uniqueRoleIds(members: readonly Member[]): RoleId[] {
  const roleIds = members.flatMap((member) =>
    member.assignments.map((assignment) => assignment.roleId),
  );
  return [...new Set(roleIds)];
}

function roleKeysOf(member: Member, keysByRoleId: ReadonlyMap<RoleId, string>): string[] {
  const keys = member.assignments.flatMap((assignment) => {
    const roleKey = keysByRoleId.get(assignment.roleId);
    return roleKey === undefined ? [] : [roleKey];
  });
  return [...new Set(keys)];
}

function toMyOrganization(
  organization: Organization,
  member: Member,
  keysByRoleId: ReadonlyMap<RoleId, string>,
): MyOrganization {
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    status: organization.status,
    roleKeys: roleKeysOf(member, keysByRoleId),
  };
}

/** Lists the organizations of one login. It spans organizations, so it runs as system access (see routes/v1.ts). */
export interface MyOrganizationsReader {
  execute(input: { readonly userId: UserId }): Promise<MyOrganization[]>;
}

/**
 * Every organization the user belongs to, for one login (ADR-022). It is three queries however
 * many organizations there are: memberships, organizations, role keys.
 */
export class ListMyOrganizationsUseCase implements MyOrganizationsReader {
  constructor(private readonly dependencies: ListMyOrganizationsDependencies) {}

  async execute(input: { readonly userId: UserId }): Promise<MyOrganization[]> {
    const { members, organizations, roleKeys } = this.dependencies;
    const memberships = await members.findActiveByUserId(
      input.userId,
      MAX_ORGANIZATIONS_PER_USER_LISTING,
    );
    if (memberships.length === 0) return [];
    const organizationIds = memberships.map((member) => member.organizationId);
    const openOrganizations = await organizations.findOpenByIds(organizationIds);
    const keysByRoleId = await roleKeys.findRoleKeysByIds(
      organizationIds,
      uniqueRoleIds(memberships),
    );
    const membershipByOrganization = new Map<OrganizationId, Member>(
      memberships.map((member) => [member.organizationId, member]),
    );
    return openOrganizations
      .flatMap((organization) => {
        const member = membershipByOrganization.get(organization.organizationId);
        return member === undefined ? [] : [toMyOrganization(organization, member, keysByRoleId)];
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  }
}
