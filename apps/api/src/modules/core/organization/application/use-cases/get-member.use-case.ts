import type { MemberId } from "@banijjik/ids";
import type { Member } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import { requireMemberInReach } from "../member-reach.js";
import type { MemberManagementRepository } from "../ports/member-management-repository.js";

/** A member outside the caller's reach is a 404, like one that does not exist. */
export class GetMemberUseCase {
  constructor(private readonly members: MemberManagementRepository) {}

  async execute(input: { readonly memberId: MemberId; readonly reach: Reach }): Promise<Member> {
    return requireMemberInReach(await this.members.findById(input.memberId), input.reach);
  }
}
