import type { Invitation } from "../../domain/invitation.entity.js";

/** An invitation with the facts the public preview shows. */
export interface InvitationWithContext {
  readonly invitation: Invitation;
  readonly organizationName: string;
  readonly invitedByDisplayName: string;
}

/**
 * Finds an invitation by the hash of its token, in any organization. It runs before any
 * organization is chosen, so routes/v1.ts wraps it as system access (AUTH_LOOKUP).
 */
export interface InvitationTokenLookup {
  findByTokenHash(tokenHash: string): Promise<InvitationWithContext | undefined>;
}
