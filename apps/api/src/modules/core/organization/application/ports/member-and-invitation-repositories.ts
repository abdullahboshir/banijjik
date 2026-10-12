import type { InvitationStatus, MemberStatus } from "@banijjik/contracts";
import type { InvitationId, LocationId, MemberId, UserId } from "@banijjik/ids";
import type { Invitation } from "../../domain/invitation.entity.js";
import type { Member } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import type { Page, PageRequest } from "./profile-and-location-repositories.js";

export interface MemberListRequest extends PageRequest {
  readonly status?: MemberStatus;
  /** Case-insensitive part of the display name. */
  readonly search?: string;
  /** Only members whose every assignment is inside this reach are listed (the filter runs in the query). */
  readonly reach: Reach;
}

/** Members of the active organization; the tenant plugin scopes every query. */
export interface MemberManagementRepository {
  insert(member: Member): Promise<void>;
  findById(memberId: MemberId): Promise<Member | undefined>;
  findByUserId(userId: UserId): Promise<Member | undefined>;
  list(request: MemberListRequest): Promise<Page<Member>>;
  countActive(): Promise<number>;
  /** True when an ACTIVE member holds a role at this location. */
  existsActiveAssignedTo(locationId: LocationId): Promise<boolean>;
  /** Saves display name, job title, assignments and status if the version is current, else a 409. */
  update(member: Member, expectedVersion: number, actorUserId: UserId): Promise<Member>;
}

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

/** An invitation with the facts the public preview shows. */
export interface InvitationWithContext {
  readonly invitation: Invitation;
  readonly organizationName: string;
  readonly invitedByDisplayName: string;
}

/**
 * Finds an invitation by the hash of its token, in any organization. It runs before any
 * organization is chosen, so routes/v1.ts wraps it as system access (AUTH_LOOKUP).
 */
export interface InvitationTokenLookup {
  findByTokenHash(tokenHash: string): Promise<InvitationWithContext | undefined>;
}

export interface IssuedInvitationToken {
  /** The secret for the link; shown once, never stored. */
  readonly token: string;
  readonly tokenHash: string;
}

export interface InvitationTokens {
  issue(): IssuedInvitationToken;
  hash(token: string): string;
}
