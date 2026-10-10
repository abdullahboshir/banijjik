import type { TokenAudience } from "@banijjik/contracts";
import { errors, jwtVerify } from "jose";
import type { Clock } from "../time/index.js";

export interface VerifiedAccessToken {
  readonly userId: string;
  readonly refreshSessionId: string;
}

/** Port of the kernel: authenticate() only needs "is this token valid for this audience". */
export interface AccessTokenVerifier {
  verify(token: string, audience: TokenAudience): Promise<VerifiedAccessToken | undefined>;
}

export const ACCESS_TOKEN_ALGORITHM = "HS256";

/** The `aud` claim of a token: the audience enum in lower case ("admin"). */
export function audienceClaim(audience: TokenAudience): string {
  return audience.toLowerCase();
}

export function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export interface JoseVerifierOptions {
  readonly secret: string;
  readonly clock: Clock;
}

/** HS256 verification with jose. Every failure (signature, expiry, audience, shape) is "not valid". */
export function createJoseAccessTokenVerifier(options: JoseVerifierOptions): AccessTokenVerifier {
  const key = secretToKey(options.secret);
  return {
    async verify(token, audience) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ACCESS_TOKEN_ALGORITHM],
          audience: audienceClaim(audience),
          currentDate: options.clock.now(),
          requiredClaims: ["sub", "sid", "exp"],
        });
        const { sub: userId, sid: refreshSessionId } = payload;
        if (typeof userId !== "string" || typeof refreshSessionId !== "string") return undefined;
        return { userId, refreshSessionId };
      } catch (error) {
        if (error instanceof errors.JOSEError) return undefined;
        throw error;
      }
    },
  };
}
