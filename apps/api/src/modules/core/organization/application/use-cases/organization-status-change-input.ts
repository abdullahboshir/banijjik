import type { OrganizationId, UserId } from "@banijjik/ids";

export interface OrganizationStatusChangeInput {
  readonly organizationId: OrganizationId;
  /** The operator's user, recorded as the author of the change. */
  readonly actorUserId: UserId;
  readonly reason: string;
}
