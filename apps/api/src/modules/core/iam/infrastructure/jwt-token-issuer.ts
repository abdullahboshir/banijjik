import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { SignJWT } from "jose";
import {
  ACCESS_TOKEN_ALGORITHM,
  audienceClaim,
  secretToKey,
} from "../../../../kernel/auth/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AccessTokenClaims, TokenIssuer } from "../application/ports/token-issuer.js";

export interface JwtTokenIssuerOptions {
  readonly secret: string;
  readonly ttlSeconds: number;
  readonly clock: Clock;
}

const MILLISECONDS_PER_SECOND = 1000;

/** Short-lived HS256 access tokens for the admin audience: `sub` is the user, `sid` the refresh session. */
export class JwtTokenIssuer implements TokenIssuer {
  private readonly key: Uint8Array;

  constructor(private readonly options: JwtTokenIssuerOptions) {
    this.key = secretToKey(options.secret);
  }

  issueAccessToken(claims: AccessTokenClaims): Promise<string> {
    const issuedAt = Math.floor(this.options.clock.now().getTime() / MILLISECONDS_PER_SECOND);
    return new SignJWT({ sid: claims.refreshSessionId })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
      .setSubject(claims.userId)
      .setAudience(audienceClaim(TOKEN_AUDIENCE.ADMIN))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.options.ttlSeconds)
      .sign(this.key);
  }
}
