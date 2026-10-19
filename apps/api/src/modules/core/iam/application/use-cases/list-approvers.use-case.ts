import { MEMBER_STATUS } from "@banijjik/contracts";
import type { ApproverSummary } from "@banijjik/contracts/iam";
import type { OrganizationId } from "@banijjik/ids";
import { canApproveAtLocation, grantMapOfMember } from "../approval-capability.js";
import type { PermissionResolver } from "../permission-resolver.js";
import type { ApprovalMemberStore } from "../ports/approval-member-store.js";
import type { RoleManagementRepository } from "../ports/role-management-repository.js";

export interface ListApproversInput {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
}

export interface ListApproversDependencies {
  readonly members: ApprovalMemberStore;
  readonly roles: RoleManagementRepository;
  readonly resolver: PermissionResolver;
}

/** Active members who hold `iam.approval.grant` at the location (ADR-121). */
export class ListApproversUseCase {
  constructor(private readonly dependencies: ListApproversDependencies) {}

  async execute(input: ListApproversInput): Promise<readonly ApproverSummary[]> {
    const { members, roles, resolver } = this.dependencies;
    const active = await members.listActive();
    const summaries: ApproverSummary[] = [];
    for (const member of active) {
      if (member.status !== MEMBER_STATUS.ACTIVE) continue;
      const grantMap = await grantMapOfMember(member, roles, resolver);
      if (!canApproveAtLocation(grantMap, input.locationId)) continue;
      summaries.push({
        memberId: member.memberId,
        displayName: member.displayName,
        hasPin: member.approvalPinHash !== undefined,
      });
    }
    return summaries.sort((left, right) => left.displayName.localeCompare(right.displayName, "en"));
  }
}
