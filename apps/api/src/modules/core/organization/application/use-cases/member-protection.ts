import type { OrganizationId, UserId } from "@banijjik/ids";
import { cannotChangeSelf, ownerIsProtected, recordNotFound } from "../../domain/errors.js";
import type { Member } from "../../domain/member.entity.js";
import type { OrganizationProfileRepository } from "../ports/organization-profile-repository.js";

export interface MemberProtectionInput {
  readonly target: Member;
  readonly actorUserId: UserId;
  readonly organizationId: OrganizationId;
  /** True for anything that changes access: assignments, suspension, removal. */
  readonly changesAssignments: boolean;
}

/**
 * The two protections of the member endpoints (ADR-046, ADR-092). The owner member can be edited
 * only by the owner and never loses or changes access; nobody changes their own access.
 */
export async function assertMemberMayBeChanged(
  dependencies: { readonly organizations: Pick<OrganizationProfileRepository, "findById"> },
  input: MemberProtectionInput,
): Promise<void> {
  const organization = await dependencies.organizations.findById(input.organizationId);
  if (organization === undefined) throw recordNotFound();
  const isOwnerMember = input.target.userId === organization.ownerUserId;
  if (isOwnerMember && (input.changesAssignments || input.target.userId !== input.actorUserId)) {
    throw ownerIsProtected();
  }
  if (input.changesAssignments && input.target.userId === input.actorUserId) {
    throw cannotChangeSelf();
  }
}
