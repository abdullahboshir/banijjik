import type { CustomerAccountId, CustomerSessionId } from "@banijjik/ids";

/** One signed-in browser of a customer. Signing out or blocking deletes it; a refresh swaps its token hash. */
export interface CustomerSession {
  readonly customerSessionId: CustomerSessionId;
  readonly customerAccountId: CustomerAccountId;
  readonly refreshTokenHash: string;
  /** The hash before the last refresh: showing it again means the old token was copied (theft detection). */
  readonly previousRefreshTokenHash: string | undefined;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly userAgentSummary: string | undefined;
}
