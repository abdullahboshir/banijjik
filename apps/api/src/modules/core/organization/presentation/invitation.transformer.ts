import type { InvitationResponse } from "@banijjik/contracts";
import type { Invitation } from "../domain/invitation.entity.js";
import { toAssignmentResponses } from "./assignment.transformer.js";

/** The token hash and the acceptance fields never leave the API. */
export function toInvitationResponse(invitation: Invitation, now: Date): InvitationResponse {
  return {
    invitationId: invitation.invitationId,
    assignments: toAssignmentResponses(invitation.assignments),
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt.toISOString(),
    status: invitation.statusAt(now),
    version: invitation.version,
    ...(invitation.email === undefined ? {} : { email: invitation.email }),
    ...(invitation.phoneE164 === undefined ? {} : { phoneE164: invitation.phoneE164 }),
    ...(invitation.displayName === undefined ? {} : { displayName: invitation.displayName }),
  };
}
