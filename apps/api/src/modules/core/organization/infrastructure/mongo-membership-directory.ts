import { MEMBER_STATUS } from "@banijjik/contracts";
import { models } from "../../../../kernel/db/index.js";
import type { ActiveMembership, MembershipDirectory } from "../../../../kernel/tenancy/index.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

type MembershipRow = Pick<MemberDocument, "memberId" | "assignments" | "version">;
type OrganizationRow = Pick<
  OrganizationDocument,
  "status" | "deployment" | "rolesVersion" | "configVersion"
>;

/**
 * "Is this user an active member of this organization?" for a request that has no organization
 * context yet. Two indexed reads: the member by { organizationId, userId }, then the organization
 * by id. It reads members without a tenant context, so routes/v1.ts runs it as system access.
 * The member and roles versions come along fresh on every request: they key the permission cache.
 */
export class MongoMembershipDirectory implements MembershipDirectory {
  async findActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<ActiveMembership | undefined> {
    const member = await models({})
      .get<MemberDocument>(MEMBER_MODEL_NAME)
      .findOne(
        { organizationId, userId, status: MEMBER_STATUS.ACTIVE },
        { memberId: 1, assignments: 1, version: 1, _id: 0 },
      )
      .lean<MembershipRow>();
    if (member === null) return undefined;
    const organization = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne(
        { organizationId },
        { status: 1, deployment: 1, rolesVersion: 1, configVersion: 1, _id: 0 },
      )
      .lean<OrganizationRow>();
    if (organization === null) return undefined;
    return {
      memberId: member.memberId,
      organizationStatus: organization.status,
      deployment: organization.deployment,
      memberVersion: member.version,
      rolesVersion: organization.rolesVersion,
      configVersion: organization.configVersion,
      assignments: member.assignments.map(({ locationId, roleId }) => ({ locationId, roleId })),
    };
  }
}
