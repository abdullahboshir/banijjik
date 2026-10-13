import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { InvitationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { recordNotFound } from "../../domain/errors.js";
import { Invitation } from "../../domain/invitation.entity.js";
import { isWithinReach } from "../../domain/reach.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import type { AssignmentGuard } from "../assignment-guard.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { InvitationRepository } from "../ports/invitation-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface RevokeInvitationInput {
  readonly actorUserId: UserId;
  /** The locations the caller may invite to; an invitation outside them looks like no invitation. */
  readonly reach: readonly string[] | "ALL";
  readonly invitationId: InvitationId;
  readonly version: number;
}

export interface RevokeInvitationDependencies {
  readonly invitations: InvitationRepository;
  readonly guard: AssignmentGuard;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/**
 * Revokes a pending invitation. The link stops working at once; an accepted or expired one cannot
 * be revoked. Taking an invitation away follows the rule for giving it (ADR-092): it must lie within
 * the caller's locations (else 404) and its roles must not be above the caller (else 422).
 */
export class RevokeInvitationUseCase {
  constructor(private readonly dependencies: RevokeInvitationDependencies) {}

  execute(input: RevokeInvitationInput): Promise<Invitation> {
    const { invitations, unitOfWork, events, audit, clock } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = await invitations.findById(input.invitationId);
      if (existing === undefined || !isWithinReach(existing.assignments, input.reach)) {
        throw recordNotFound();
      }
      await this.dependencies.guard.assertCallerHolds(existing.assignments);
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
