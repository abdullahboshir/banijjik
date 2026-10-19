import { createHash, randomBytes } from "node:crypto";
import type {
  ApprovalTokenSecrets,
  IssuedApprovalToken,
} from "../application/ports/approval-token-secrets.js";

const APPROVAL_TOKEN_BYTES = 32;

/** 32 random bytes as base64url; only the SHA-256 of the token is stored (ADR-121). */
export class RandomApprovalTokens implements ApprovalTokenSecrets {
  issue(): IssuedApprovalToken {
    const token = randomBytes(APPROVAL_TOKEN_BYTES).toString("base64url");
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
