import type { OrganizationId, UserId } from "@banijjik/ids";

export interface MemberActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}
