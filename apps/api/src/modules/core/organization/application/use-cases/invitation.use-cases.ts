import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  LIMIT_KEY,
  MEMBER_STATUS,
  ORGANIZATION_EVENT_TYPE,
} from "@banijjik/contracts";
import type { InvitationId, OrganizationId, UserId } from "@banijjik/ids";
import type { LimitGuard } from "../../../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { DuplicateFieldError, recordNotFound } from "../../domain/errors.js";
import { Invitation } from "../../domain/invitation.entity.js";
import type { Assignment } from "../../domain/member.entity.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { assignmentsAuditValue } from "../audit-diff.js";
import type { AssignmentGuard } from "../assignment-guard.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { UserIdentifierLookup } from "../ports/iam-ports.js";
import type {
  InvitationListRequest,
  InvitationRepository,
  InvitationTokens,
  MemberManagementRepository,
} from "../ports/member-and-invitation-repositories.js";
import type { OrganizationLimitLock, Page } from "../ports/profile-and-location-repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  execute(request: InvitationListRequest): Promise<Page<Invitation>> {
    return this.invitations.list(request);
  }
}

export interface CreateInvitationInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly email?: string;
  readonly phoneE164?: string;
  readonly displayName?: string;
  readonly assignments: readonly Assignment[];
}

export interface CreateInvitationDependencies {
  readonly invitations: InvitationRepository;
  readonly members: Pick<MemberManagementRepository, "findByUserId" | "countActive">;
  readonly users: Pick<UserIdentifierLookup, "findUserIdByIdentifier">;
  readonly guard: AssignmentGuard;
  readonly limits: LimitGuard;
  readonly limitLock: OrganizationLimitLock;
  readonly tokens: InvitationTokens;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface CreatedInvitation {
  readonly invitation: Invitation;
  /** The secret for the invitation link. It exists only in this result: nothing stores it. */
  readonly token: string;
}

/**
 * Invites a person by email or phone number with the roles they will get (ADR-092). The same
 * assignment and anti-escalation rules as editing a member apply. The `members` limit counts
 * ACTIVE members plus pending invitations, so invitations cannot overshoot it.
 */
export class CreateInvitationUseCase {
  constructor(private readonly dependencies: CreateInvitationDependencies) {}

  execute(input: CreateInvitationInput): Promise<CreatedInvitation> {
    const { unitOfWork, guard, tokens, clock } = this.dependencies;
    const issued = tokens.issue();
    const invitation = Invitation.issue({
      organizationId: input.organizationId,
      email: input.email,
      phoneE164: input.phoneE164,
      displayName: input.displayName,
      assignments: input.assignments,
      invitedByUserId: input.actorUserId,
      tokenHash: issued.tokenHash,
      now: clock.now(),
    });
    return unitOfWork.run(async () => {
      await guard.assertCanGrant(input.assignments);
      await this.assertIdentifierIsNew(invitation);
      await this.assertRoomForOneMore(input.organizationId);
      await this.dependencies.invitations.insert(invitation);
      await this.record(invitation);
      return { invitation, token: issued.token };
    });
  }

  /** A person who is already ACTIVE or SUSPENDED in this organization cannot be invited again. */
  private async assertIdentifierIsNew(invitation: Invitation): Promise<void> {
    const { users, members } = this.dependencies;
    const field = invitation.email === undefined ? "phone" : "email";
    const userId = await users.findUserIdByIdentifier(
      invitation.email === undefined
        ? { phoneE164: invitation.phoneE164 ?? "" }
        : { email: invitation.email },
    );
    if (userId === undefined) return;
    const existing = await members.findByUserId(userId);
    if (existing !== undefined && existing.status !== MEMBER_STATUS.REMOVED) {
      throw new DuplicateFieldError(field);
    }
  }

  private async assertRoomForOneMore(organizationId: OrganizationId): Promise<void> {
    const { members, invitations, limits, limitLock, clock } = this.dependencies;
    await limitLock.acquire(organizationId);
    const active = await members.countActive();
    const pending = await invitations.countPending(clock.now());
    await limits.assertBelow(LIMIT_KEY.MEMBERS, active + pending);
  }

  private async record(invitation: Invitation): Promise<void> {
    const { audit, events } = this.dependencies;
    // Only the kind of identifier is recorded: the address itself is personal data.
    await audit.record({
      action: AUDIT_ACTION.INVITATION_CREATED,
      entityType: AUDIT_ENTITY_TYPE.invitation,
      entityId: invitation.invitationId,
      changes: diffAuditFields(
        {},
        {
          identifierKind: invitation.email === undefined ? "phone" : "email",
          assignments: assignmentsAuditValue(invitation.assignments),
        },
      ),
    });
    await events.publish(ORGANIZATION_EVENT_TYPE.MEMBER_INVITED, {
      invitationId: invitation.invitationId,
    });
  }
}

export interface RevokeInvitationInput {
  readonly actorUserId: UserId;
  readonly invitationId: InvitationId;
  readonly version: number;
}

export interface RevokeInvitationDependencies {
  readonly invitations: InvitationRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** Revokes a pending invitation. The link stops working at once; an accepted or expired one cannot be revoked. */
export class RevokeInvitationUseCase {
  constructor(private readonly dependencies: RevokeInvitationDependencies) {}

  execute(input: RevokeInvitationInput): Promise<Invitation> {
    const { invitations, unitOfWork, events, audit, clock } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = await invitations.findById(input.invitationId);
      if (existing === undefined) throw recordNotFound();
      const revoked = existing.revoke(clock.now());
      const saved = await invitations.update(revoked, input.version, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.INVITATION_REVOKED,
        entityType: AUDIT_ENTITY_TYPE.invitation,
        entityId: saved.invitationId,
        changes: diffAuditFields({ status: existing.status }, { status: saved.status }),
      });
      await events.publish(ORGANIZATION_EVENT_TYPE.INVITATION_REVOKED, {
        invitationId: saved.invitationId,
      });
      return saved;
    });
  }
}
