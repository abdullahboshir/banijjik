import type { InvitationStatus } from "@banijjik/contracts";
import type { InvitationId, LocationId, UserId } from "@banijjik/ids";
import type { Invitation } from "../../domain/invitation.entity.js";
import type { Reach } from "../../domain/reach.js";
import type { Page, PageRequest } from "./page.js";

export interface InvitationListRequest extends PageRequest {
  readonly status?: InvitationStatus;
  readonly now: Date;
  /** The locations the caller may invite to, "ALL" for every one. Only invitations inside it are listed. */
  readonly reach: Reach;
}

/** Invitations of the active organization; the tenant plugin scopes every query. */
export interface InvitationRepository {
  insert(invitation: Invitation): Promise<void>;
  findById(invitationId: InvitationId): Promise<Invitation | undefined>;
  list(request: InvitationListRequest): Promise<Page<Invitation>>;
  /** Every PENDING, unexpired invitation sent by this user (bounded by the `members` limit). */
  listPendingInvitedBy(userId: UserId, now: Date): Promise<Invitation[]>;
  /** PENDING invitations that have not expired; they count against the `members` limit. */
  countPending(now: Date): Promise<number>;
  /** True when a PENDING, unexpired invitation names this location. */
  existsPendingNaming(locationId: LocationId, now: Date): Promise<boolean>;
  /** Saves the status and acceptance fields if the version is current, else a 409. */
  update(invitation: Invitation, expectedVersion: number, actorUserId: UserId): Promise<Invitation>;
}
