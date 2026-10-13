import type { OrganizationId, UserId } from "@banijjik/ids";

export interface ActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}
