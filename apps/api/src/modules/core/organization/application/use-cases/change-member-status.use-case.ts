import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { MemberId, OrganizationId } from "@banijjik/ids";
import { DomainRuleError, memberAssignmentsInvalid } from "../../domain/errors.js";
import type { Member } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { requireMemberInReach } from "../member-reach.js";
import { assertMemberMayBeChanged } from "./member-protection.js";
import { revokeInvitationsOfInviter } from "./revoke-inviter-invitations.js";
import type { MemberActorInput } from "./member-actor-input.js";
import type { MemberDependencies } from "./member-dependencies.js";

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
