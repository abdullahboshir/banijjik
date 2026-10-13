import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  INVITATION_REVOKE_REASON,
  ORGANIZATION_EVENT_TYPE,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields, type AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { Invitation } from "../../domain/invitation.entity.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { InvitationRepository } from "../ports/invitation-repository.js";

export interface InviterRevocationDependencies {
  readonly invitations: InvitationRepository;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/**
 * Revokes one pending invitation because its inviter no longer has the access it was sent with
 * (review J1). Runs inside the transaction of the change that caused it, so the invitation dies
 * exactly when the access does. The audit entry says why; the event is the one a manual revoke sends.
 */
export async function revokeBecauseInviterAccessChanged(
  dependencies: InviterRevocationDependencies,
  invitation: Invitation,
  actorUserId: UserId,
): Promise<void> {
  const { invitations, events, audit, clock } = dependencies;
  const saved = await invitations.update(
    invitation.revoke(clock.now()),
    invitation.version,
    actorUserId,
  );
  await audit.record({
    action: AUDIT_ACTION.INVITATION_REVOKED,
    entityType: AUDIT_ENTITY_TYPE.invitation,
    entityId: saved.invitationId,
    changes: diffAuditFields(
      { status: invitation.status },
      { status: saved.status, reason: INVITATION_REVOKE_REASON.INVITER_ACCESS_CHANGED },
    ),
  });
  await events.publish(ORGANIZATION_EVENT_TYPE.INVITATION_REVOKED, {
    invitationId: saved.invitationId,
  });
}

/** Every pending invitation a member sent dies with the access they sent it with. */
export async function revokeInvitationsOfInviter(
  dependencies: InviterRevocationDependencies,
  inviterUserId: UserId,
  actorUserId: UserId,
): Promise<void> {
  const pending = await dependencies.invitations.listPendingInvitedBy(
    inviterUserId,
    dependencies.clock.now(),
  );
  for (const invitation of pending) {
    await revokeBecauseInviterAccessChanged(dependencies, invitation, actorUserId);
  }
}
