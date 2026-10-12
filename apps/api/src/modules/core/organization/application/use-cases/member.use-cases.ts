import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { MemberId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { diffAssignments } from "../../domain/assignment-rules.js";
import { DomainRuleError, memberAssignmentsInvalid } from "../../domain/errors.js";
import type { Member, MemberChanges } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import { diffAuditFields, type AuditFields } from "../../../../../kernel/audit/index.js";
import { assignmentsAuditValue } from "../audit-diff.js";
import type { AssignmentGuard } from "../assignment-guard.js";
import { assertAssignmentsInReach, requireMemberInReach } from "../member-reach.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type {
  InvitationRepository,
  MemberListRequest,
  MemberManagementRepository,
} from "../ports/member-and-invitation-repositories.js";
import type {
  OrganizationProfileRepository,
  Page,
} from "../ports/profile-and-location-repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { assertMemberMayBeChanged } from "./member-protection.js";
import { revokeInvitationsOfInviter } from "./revoke-inviter-invitations.js";

export interface MemberDependencies {
  readonly members: MemberManagementRepository;
  readonly organizations: Pick<OrganizationProfileRepository, "findById">;
  readonly guard: AssignmentGuard;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  /** A member who loses access takes the invitations they sent with them (review J1). */
  readonly invitations: InvitationRepository;
  readonly clock: Clock;
}

export interface MemberActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export function memberAuditFields(member: Member): AuditFields {
  return {
    status: member.status,
    displayName: member.displayName,
    jobTitle: member.jobTitle,
    assignments: assignmentsAuditValue(member.assignments),
  };
}

export class ListMembersUseCase {
  constructor(private readonly members: MemberManagementRepository) {}

  execute(request: MemberListRequest): Promise<Page<Member>> {
    return this.members.list(request);
  }
}

/** A member outside the caller's reach is a 404, like one that does not exist. */
export class GetMemberUseCase {
  constructor(private readonly members: MemberManagementRepository) {}

  async execute(input: { readonly memberId: MemberId; readonly reach: Reach }): Promise<Member> {
    return requireMemberInReach(await this.members.findById(input.memberId), input.reach);
  }
}

export interface UpdateMemberInput extends MemberActorInput {
  readonly memberId: MemberId;
  readonly version: number;
  readonly changes: MemberChanges;
  /** Where the caller holds `organization.member.update`: the member and the new assignments must lie inside. */
  readonly reach: Reach;
}

/**
 * Edits a member's display name, job title and assignments (ADR-092). Changing assignments is
 * the sensitive part: the OWNER role is never assignable, nobody changes their own, the owner
 * member is protected, and the caller must already hold every permission of every role they give
 * or take away. The member version moves, so the next request of that member sees the change.
 */
export class UpdateMemberUseCase {
  constructor(private readonly dependencies: MemberDependencies) {}

  execute(input: UpdateMemberInput): Promise<Member> {
    const { members, unitOfWork } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = requireMemberInReach(await members.findById(input.memberId), input.reach);
      await assertMemberMayBeChanged(this.dependencies, {
        target: existing,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        changesAssignments: input.changes.assignments !== undefined,
      });
      const edited = existing.withChanges(input.changes);
      assertAssignmentsInReach(edited.assignments, input.reach);
      const hasChangedAssignments = await this.guardAssignments(existing, edited);
      const saved = await members.update(edited, input.version, input.actorUserId);
      await this.record(existing, saved);
      if (hasChangedAssignments) {
        await revokeInvitationsOfInviter(this.dependencies, existing.userId, input.actorUserId);
      }
      return saved;
    });
  }

  /** Returns whether the assignments changed at all. */
  private async guardAssignments(before: Member, after: Member): Promise<boolean> {
    const { guard } = this.dependencies;
    const { added, removed } = diffAssignments(before.assignments, after.assignments);
    if (added.length === 0 && removed.length === 0) return false;
    await guard.assertAssignable(after.assignments);
    await guard.assertCallerHolds([...added, ...removed]);
    return true;
  }

  private async record(before: Member, after: Member): Promise<void> {
    const { audit, events } = this.dependencies;
    const changes = diffAuditFields(memberAuditFields(before), memberAuditFields(after));
    await audit.record({
      action: AUDIT_ACTION.MEMBER_UPDATED,
      entityType: AUDIT_ENTITY_TYPE.member,
      entityId: after.memberId,
      changes,
    });
    // A rename alone changes nobody's access, so it publishes nothing (as a role rename does).
    if (changes["assignments"] === undefined) return;
    await events.publish(ORGANIZATION_EVENT_TYPE.MEMBER_ASSIGNMENTS_CHANGED, {
      memberId: after.memberId,
      userId: after.userId,
    });
  }
}

export type MemberStatusAction = "SUSPEND" | "REACTIVATE" | "REMOVE";

export interface ChangeMemberStatusInput extends MemberActorInput {
  readonly memberId: MemberId;
  readonly version: number;
  readonly action: MemberStatusAction;
  /** Where the caller holds the permission of this transition: the member must lie inside. */
  readonly reach: Reach;
}

const ACTION_AUDIT = {
  SUSPEND: AUDIT_ACTION.MEMBER_SUSPENDED,
  REACTIVATE: AUDIT_ACTION.MEMBER_REACTIVATED,
  REMOVE: AUDIT_ACTION.MEMBER_REMOVED,
} as const;

const ACTION_EVENT = {
  SUSPEND: ORGANIZATION_EVENT_TYPE.MEMBER_SUSPENDED,
  REACTIVATE: ORGANIZATION_EVENT_TYPE.MEMBER_REACTIVATED,
  REMOVE: ORGANIZATION_EVENT_TYPE.MEMBER_REMOVED,
} as const;

function nextStatusOf(member: Member, action: MemberStatusAction): Member {
  if (action === "SUSPEND") return member.suspend();
  if (action === "REACTIVATE") return member.reactivate();
  return member.remove();
}

export interface ChangeMemberStatusDependencies extends MemberDependencies {
  /** Reactivating adds an ACTIVE member, so the `members` limit is checked (ACTIVE + pending invitations). */
  readonly assertRoomForOneMore: (organizationId: OrganizationId) => Promise<void>;
}

/**
 * Suspends, reactivates or removes a member. A suspended or removed member loses access on the
 * next request, because the tenant context only accepts ACTIVE members. Removal keeps the record.
 */
export class ChangeMemberStatusUseCase {
  constructor(private readonly dependencies: ChangeMemberStatusDependencies) {}

  execute(input: ChangeMemberStatusInput): Promise<Member> {
    const { members, unitOfWork, audit, events } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = requireMemberInReach(await members.findById(input.memberId), input.reach);
      await assertMemberMayBeChanged(this.dependencies, {
        target: existing,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        changesAssignments: true,
      });
      const next = nextStatusOf(existing, input.action);
      await this.dependencies.guard.assertCallerHolds(existing.assignments);
      if (input.action === "REACTIVATE") await this.assertCanComeBack(existing, input);
      const saved = await members.update(next, input.version, input.actorUserId);
      await audit.record({
        action: ACTION_AUDIT[input.action],
        entityType: AUDIT_ENTITY_TYPE.member,
        entityId: saved.memberId,
        changes: diffAuditFields({ status: existing.status }, { status: saved.status }),
      });
      await events.publish(ACTION_EVENT[input.action], {
        memberId: saved.memberId,
        userId: saved.userId,
      });
      if (input.action !== "REACTIVATE") {
        await revokeInvitationsOfInviter(this.dependencies, saved.userId, input.actorUserId);
      }
      return saved;
    });
  }

  /**
   * A member who was suspended may have had a location or role archived meanwhile (those archives
   * count ACTIVE members only), so coming back re-checks them (review J5). The owner of the change
   * fixes the assignments first; editing a suspended member is allowed.
   */
  private async assertCanComeBack(existing: Member, input: ChangeMemberStatusInput): Promise<void> {
    try {
      await this.dependencies.guard.assertAssignable(existing.assignments);
    } catch (error) {
      if (error instanceof DomainRuleError) throw memberAssignmentsInvalid();
      throw error;
    }
    await this.dependencies.assertRoomForOneMore(input.organizationId);
  }
}
