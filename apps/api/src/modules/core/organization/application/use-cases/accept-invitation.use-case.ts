import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  MEMBER_STATUS,
  ORGANIZATION_EVENT_TYPE,
  type InvitationStatus,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  DuplicateFieldError,
  invitationIdentifierMismatch,
  recordNotFound,
  sessionNotValid,
} from "../../domain/errors.js";
import type { Invitation } from "../../domain/invitation.entity.js";
import { Member } from "../../domain/member.entity.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { assignmentsAuditValue } from "../audit-diff.js";
import type { AssignmentGuard } from "../assignment-guard.js";
import type { MyOrganization } from "../my-organization.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { ActorProfileReader, UserIdentifierLookup } from "../ports/iam-ports.js";
import type { MemberNumberSequence } from "../ports/member-number-sequence.js";
import type {
  InvitationRepository,
  InvitationTokenLookup,
  InvitationTokens,
  MemberManagementRepository,
} from "../ports/member-and-invitation-repositories.js";
import type { OrganizationContextRunner } from "../ports/organization-context-runner.js";
import type { OrganizationLimitLock } from "../ports/profile-and-location-repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { revokeBecauseInviterAccessChanged } from "./revoke-inviter-invitations.js";
import type { MyOrganizationsReader } from "./list-my-organizations.use-case.js";

export interface InvitationPreview {
  readonly organizationName: string;
  readonly invitedByDisplayName: string;
  readonly identifierHint: string;
  readonly status: InvitationStatus;
}

/**
 * What the public link shows before sign-in. An unknown, expired, revoked or used token is the
 * same 404, so the link reveals nothing about which one it was.
 */
export class PreviewInvitationUseCase {
  constructor(
    private readonly dependencies: {
      readonly tokens: InvitationTokens;
      readonly lookup: InvitationTokenLookup;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { readonly token: string }): Promise<InvitationPreview> {
    const { tokens, lookup, clock } = this.dependencies;
    const found = await lookup.findByTokenHash(tokens.hash(input.token));
    const now = clock.now();
    if (found === undefined || !found.invitation.isPendingAt(now)) throw recordNotFound();
    return {
      organizationName: found.organizationName,
      invitedByDisplayName: found.invitedByDisplayName,
      identifierHint: found.invitation.identifierHint(),
      status: found.invitation.statusAt(now),
    };
  }
}

export interface AcceptInvitationDependencies {
  readonly tokens: InvitationTokens;
  readonly lookup: InvitationTokenLookup;
  readonly users: Pick<UserIdentifierLookup, "findIdentifiers">;
  readonly actorProfiles: ActorProfileReader;
  readonly invitations: InvitationRepository;
  readonly members: MemberManagementRepository;
  readonly guard: AssignmentGuard;
  /** Accepting turns a counted pending invitation into a member, so it takes the same lock as the creates. */
  readonly limitLock: OrganizationLimitLock;
  readonly memberNumbers: MemberNumberSequence;
  readonly myOrganizations: MyOrganizationsReader;
  readonly contextRunner: OrganizationContextRunner;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

type JoinOutcome = "JOINED" | "INVITER_LOST_ACCESS";

interface JoinInput {
  readonly invitation: Invitation;
  readonly userId: UserId;
  readonly displayName: string;
  readonly employeeNumber: string;
}

/**
 * Accepts an invitation as the signed-in user. The user's email or phone number must equal the
 * invited one (the only binding until identifiers are verified, STATUS gap). Creates the member,
 * or brings a REMOVED one back, and closes the invitation in one transaction, inside the
 * organization's context. A second accept finds no pending invitation: 404.
 */
export class AcceptInvitationUseCase {
  constructor(private readonly dependencies: AcceptInvitationDependencies) {}

  async execute(input: {
    readonly token: string;
    readonly userId: UserId;
  }): Promise<MyOrganization> {
    const { tokens, lookup, clock, contextRunner } = this.dependencies;
    const found = await lookup.findByTokenHash(tokens.hash(input.token));
    if (found === undefined || !found.invitation.isPendingAt(clock.now())) throw recordNotFound();
    const { invitation } = found;
    await this.assertAddressedTo(invitation, input.userId);
    const displayName = invitation.displayName ?? (await this.nameOf(input.userId));
    const outcome = await contextRunner.run(invitation.organizationId, () =>
      this.join({ invitation, userId: input.userId, displayName }),
    );
    // The revocation was committed first; the invitee only sees a link that no longer works.
    if (outcome === "INVITER_LOST_ACCESS") throw recordNotFound();
    return this.summaryOf(input.userId, invitation.organizationId);
  }

  private async assertAddressedTo(invitation: Invitation, userId: UserId): Promise<void> {
    const identifiers = await this.dependencies.users.findIdentifiers(userId);
    if (identifiers === undefined) throw sessionNotValid();
    if (!invitation.isAddressedTo(identifiers)) throw invitationIdentifierMismatch();
  }

  private async nameOf(userId: UserId): Promise<string> {
    const profile = await this.dependencies.actorProfiles.findProfile(userId);
    if (profile === undefined) throw sessionNotValid();
    return profile.name;
  }

  /** The MEMBER number is taken before the transaction (FAST sequence): an abort loses it, never repeats it. */
  private async join(input: Omit<JoinInput, "employeeNumber">): Promise<JoinOutcome> {
    const { memberNumbers, unitOfWork } = this.dependencies;
    const number = await memberNumbers.next(input.invitation.organizationId);
    return unitOfWork.run(() => this.store({ ...input, employeeNumber: String(number) }));
  }

  private async store(input: JoinInput): Promise<JoinOutcome> {
    const { invitations, members, guard, limitLock, clock, audit, events } = this.dependencies;
    const { userId } = input;
    await limitLock.acquire(input.invitation.organizationId);
    const current = await invitations.findById(input.invitation.invitationId);
    if (current === undefined || !current.isPendingAt(clock.now())) throw recordNotFound();
    if (!(await this.inviterStillMayGrant(current))) {
      await revokeBecauseInviterAccessChanged(this.dependencies, current, userId);
      return "INVITER_LOST_ACCESS";
    }
    await guard.assertAssignable(current.assignments);
    const existing = await members.findByUserId(userId);
    if (existing !== undefined && existing.status !== MEMBER_STATUS.REMOVED) {
      throw new DuplicateFieldError("userId");
    }
    const joined = await this.saveMember(current, existing, input);
    await invitations.update(current.accept(userId, clock.now()), current.version, userId);
    await audit.record({
      action: AUDIT_ACTION.MEMBER_JOINED,
      entityType: AUDIT_ENTITY_TYPE.member,
      entityId: joined.memberId,
      changes: diffAuditFields({}, { assignments: assignmentsAuditValue(joined.assignments) }),
    });
    await events.publish(ORGANIZATION_EVENT_TYPE.MEMBER_JOINED, {
      memberId: joined.memberId,
      userId,
    });
    return "JOINED";
  }

  /**
   * The check of ADR-092 was made when the invitation was created; access moves since then. The
   * inviter must still be an ACTIVE member who holds every key of every invited role (review J1).
   */
  private async inviterStillMayGrant(invitation: Invitation): Promise<boolean> {
    const inviter = await this.dependencies.members.findByUserId(invitation.invitedByUserId);
    if (inviter === undefined || inviter.status !== MEMBER_STATUS.ACTIVE) return false;
    return this.dependencies.guard.holderMayGrant(inviter.assignments, invitation.assignments);
  }

  private async saveMember(
    invitation: Invitation,
    existing: Member | undefined,
    input: JoinInput,
  ): Promise<Member> {
    const { members, clock } = this.dependencies;
    const now = clock.now();
    if (existing !== undefined) {
      const rejoined = existing.rejoin({
        displayName: input.displayName,
        assignments: invitation.assignments,
        now,
      });
      return members.update(rejoined, existing.version, input.userId);
    }
    const created = Member.joinActive({
      organizationId: invitation.organizationId,
      userId: input.userId,
      displayName: input.displayName,
      assignments: invitation.assignments,
      employeeNumber: input.employeeNumber,
      createdByUserId: input.userId,
      now,
    });
    await members.insert(created);
    return created;
  }

  private async summaryOf(userId: UserId, organizationId: OrganizationId): Promise<MyOrganization> {
    const organizations = await this.dependencies.myOrganizations.execute({ userId });
    const summary = organizations.find((candidate) => candidate.organizationId === organizationId);
    if (summary === undefined) throw recordNotFound();
    return summary;
  }
}
