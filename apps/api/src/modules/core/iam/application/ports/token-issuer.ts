import type { UserId } from "@banijjik/ids";

export interface AccessTokenClaims {
  readonly userId: UserId;
  readonly refreshSessionId: string;
}

export interface TokenIssuer {
  /** A signed, short-lived access token for the admin audience. */
  issueAccessToken(claims: AccessTokenClaims): Promise<string>;
}
