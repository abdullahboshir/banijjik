import {
  INVITATION_STATUS,
  INVITATION_VALIDITY_DAYS,
  type InvitationStatus,
} from "@banijjik/contracts";
import { newId, type InvitationId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField, invalidTransition } from "./errors.js";
import { assertAssignmentsAreConsistent, type Assignment } from "./member.entity.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const HINT_VISIBLE_PHONE_DIGITS = 3;

export interface InvitationProps {
  readonly invitationId: InvitationId;
  readonly organizationId: OrganizationId;
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
  readonly displayName: string | undefined;
  readonly assignments: readonly Assignment[];
  readonly invitedByUserId: UserId;
  /** SHA-256 of the secret token; the token itself is never stored. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  /** The stored status. A PENDING invitation past its date reads as EXPIRED, see `statusAt`. */
  readonly status: InvitationStatus;
  readonly acceptedByUserId: UserId | undefined;
  readonly acceptedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewInvitationInput {
  readonly organizationId: OrganizationId;
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
  readonly displayName: string | undefined;
  readonly assignments: readonly Assignment[];
  readonly invitedByUserId: UserId;
  readonly tokenHash: string;
  readonly now: Date;
}

/** The identifiers of the signed-in user that an invitation is matched against. */
export interface UserIdentifiers {
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskPhone(phoneE164: string): string {
  return `***${phoneE164.slice(-HINT_VISIBLE_PHONE_DIGITS)}`;
}

/** An invitation to join an organization, sent to a phone number or an email (09 section 4.4). */
export class Invitation implements InvitationProps {
  readonly invitationId: InvitationId;
  readonly organizationId: OrganizationId;
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
  readonly displayName: string | undefined;
  readonly assignments: readonly Assignment[];
  readonly invitedByUserId: UserId;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly status: InvitationStatus;
  readonly acceptedByUserId: UserId | undefined;
  readonly acceptedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: InvitationProps) {
    this.invitationId = props.invitationId;
    this.organizationId = props.organizationId;
    this.email = props.email;
    this.phoneE164 = props.phoneE164;
    this.displayName = props.displayName;
    this.assignments = props.assignments;
    this.invitedByUserId = props.invitedByUserId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.status = props.status;
    this.acceptedByUserId = props.acceptedByUserId;
    this.acceptedAt = props.acceptedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** A PENDING invitation that expires after the validity period. Exactly one identifier is given. */
  static issue(input: NewInvitationInput): Invitation {
    if ((input.email === undefined) === (input.phoneE164 === undefined)) {
      throw invalidField("email", "validation.identifier_required");
    }
    assertAssignmentsAreConsistent(input.assignments);
    return new Invitation({
      invitationId: newId(),
      organizationId: input.organizationId,
      email: input.email,
      phoneE164: input.phoneE164,
      displayName: input.displayName,
      assignments: input.assignments,
      invitedByUserId: input.invitedByUserId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + INVITATION_VALIDITY_DAYS * MILLISECONDS_PER_DAY),
      status: INVITATION_STATUS.PENDING,
      acceptedByUserId: undefined,
      acceptedAt: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.invitedByUserId,
    });
  }

  /** Rebuilds a stored invitation. The stored data was checked when it was written. */
  static restore(props: InvitationProps): Invitation {
    return new Invitation(props);
  }

  /** The status a reader sees at `now`: a PENDING invitation past its date is EXPIRED. */
  statusAt(now: Date): InvitationStatus {
    const isExpired = this.status === INVITATION_STATUS.PENDING && this.expiresAt <= now;
    return isExpired ? INVITATION_STATUS.EXPIRED : this.status;
  }

  isPendingAt(now: Date): boolean {
    return this.statusAt(now) === INVITATION_STATUS.PENDING;
  }

  revoke(now: Date): Invitation {
    this.assertPendingAt(now);
    return new Invitation({ ...this, status: INVITATION_STATUS.REVOKED });
  }

  accept(userId: UserId, now: Date): Invitation {
    this.assertPendingAt(now);
    return new Invitation({
      ...this,
      status: INVITATION_STATUS.ACCEPTED,
      acceptedByUserId: userId,
      acceptedAt: now,
    });
  }

  /** True when the user owns the email or the phone number the invitation was sent to. */
  isAddressedTo(identifiers: UserIdentifiers): boolean {
    if (this.email !== undefined) return this.email === identifiers.email;
    return this.phoneE164 !== undefined && this.phoneE164 === identifiers.phoneE164;
  }

  /** The identifier with its middle hidden, safe to show before sign-in. */
  identifierHint(): string {
    if (this.email !== undefined) return maskEmail(this.email);
    return maskPhone(this.phoneE164 ?? "");
  }

  private assertPendingAt(now: Date): void {
    const current = this.statusAt(now);
    if (current !== INVITATION_STATUS.PENDING) throw invalidTransition(current);
  }
}
