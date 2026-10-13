import type { Member } from "../../domain/member.entity.js";
import type {
  MemberListRequest,
  MemberManagementRepository,
} from "../ports/member-management-repository.js";
import type { Page } from "../ports/page.js";

export class ListMembersUseCase {
  constructor(private readonly members: MemberManagementRepository) {}

  execute(request: MemberListRequest): Promise<Page<Member>> {
    return this.members.list(request);
  }
}
