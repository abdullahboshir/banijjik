import { createHash, randomBytes } from "node:crypto";
import { INVITATION_TOKEN_BYTES } from "@banijjik/contracts";
import type {
  InvitationTokens,
  IssuedInvitationToken,
} from "../application/ports/invitation-tokens.js";

/** 32 random bytes as base64url; only the SHA-256 of the token is stored (ADR-092). */
export class RandomInvitationTokens implements InvitationTokens {
  issue(): IssuedInvitationToken {
    const token = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
