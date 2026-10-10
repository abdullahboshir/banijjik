import type { TokenAudience } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";

export interface AccessTokenClaims {
  readonly userId: UserId;
  readonly refreshSessionId: string;
  /** Defaults to ADMIN. */
  readonly audience?: TokenAudience;
}

export interface TokenIssuer {
  /** A signed, short-lived access token for the audience of the claims (ADMIN unless stated). */
  issueAccessToken(claims: AccessTokenClaims): Promise<string>;
}
