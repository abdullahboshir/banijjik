import type { OrganizationId, UserId } from "@banijjik/ids";

/** Who is acting, and in which organization (from the request context, never from the body). */
export interface ContactActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}
