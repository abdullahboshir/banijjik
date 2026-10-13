import type { InvitationPreviewResponse } from "@banijjik/contracts";
import type { InvitationPreview } from "../application/use-cases/accept-invitation.use-case.js";

export function toInvitationPreviewResponse(preview: InvitationPreview): InvitationPreviewResponse {
  return {
    organizationName: preview.organizationName,
    invitedByDisplayName: preview.invitedByDisplayName,
    identifierHint: preview.identifierHint,
    status: preview.status,
  };
}
