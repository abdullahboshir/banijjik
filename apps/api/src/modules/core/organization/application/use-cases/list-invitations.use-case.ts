import { Invitation } from "../../domain/invitation.entity.js";
import type {
  InvitationListRequest,
  InvitationRepository,
} from "../ports/invitation-repository.js";
import type { Page } from "../ports/page.js";

export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  execute(request: InvitationListRequest): Promise<Page<Invitation>> {
    return this.invitations.list(request);
  }
}
