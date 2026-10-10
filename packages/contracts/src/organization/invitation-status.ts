import { defineEnum } from "../define-enum.js";

/** EXPIRED is derived from `expiresAt` when an invitation is read; a stored PENDING row past its date counts as EXPIRED (09-DOMAIN-MODEL section 4.4). */
export const INVITATION_STATUS = defineEnum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]);

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

/** The secret in an invitation link: 32 random bytes, base64url (43 characters). Only its hash is stored. */
export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TOKEN_LENGTH = 43;

export const INVITATION_VALIDITY_DAYS = 7;
