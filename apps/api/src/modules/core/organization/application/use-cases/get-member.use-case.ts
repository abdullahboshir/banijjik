import type { MemberId, OrganizationId } from "@banijjik/ids";
import type { Reach } from "../../domain/reach.js";
import { viewMember, type MemberDetailView } from "../custom-field-view.js";
import { requireMemberInReach } from "../member-reach.js";
import type {
  OrganizationCustomFieldReader,
  SensitiveValueAccess,
} from "../ports/custom-field-ports.js";
import type { MemberManagementRepository } from "../ports/member-management-repository.js";

export interface GetMemberDependencies {
  readonly members: MemberManagementRepository;
  readonly customFields: OrganizationCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
}

/** A member outside the caller's reach is a 404, like one that does not exist. */
export class GetMemberUseCase {
  constructor(private readonly dependencies: GetMemberDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly memberId: MemberId;
    readonly reach: Reach;
  }): Promise<MemberDetailView> {
    const { members, customFields, sensitiveAccess } = this.dependencies;
    const member = requireMemberInReach(await members.findById(input.memberId), input.reach);
    const fields = await customFields.forEntity(input.organizationId, "member");
    return viewMember(sensitiveAccess, member, fields);
  }
}
