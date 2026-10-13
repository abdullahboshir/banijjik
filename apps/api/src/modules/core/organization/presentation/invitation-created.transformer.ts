import type { InvitationCreatedResponse } from "@banijjik/contracts";
import type { Invitation } from "../domain/invitation.entity.js";
import { toInvitationResponse } from "./invitation.transformer.js";

export const INVITE_URL_PATH_PREFIX = "/invitations/";

export function toInvitationCreatedResponse(
  invitation: Invitation,
  token: string,
  now: Date,
): InvitationCreatedResponse {
  return {
    ...toInvitationResponse(invitation, now),
    inviteUrlPath: `${INVITE_URL_PATH_PREFIX}${token}`,
  };
}
