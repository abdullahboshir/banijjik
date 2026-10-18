import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { errors, jwtVerify, SignJWT } from "jose";
import type { Clock } from "../time/index.js";
import { ACCESS_TOKEN_ALGORITHM, audienceClaim, secretToKey } from "./access-token-verifier.js";

const MILLISECONDS_PER_SECOND = 1000;
const ORGANIZATION_CLAIM = "org";

export interface CustomerTokenClaims {
  readonly customerAccountId: string;
  readonly organizationId: string;
}

/** Port of the kernel: authenticateCustomer() only needs "is this a valid customer token, and for whom". */
export interface CustomerTokenVerifier {
  verify(token: string): Promise<CustomerTokenClaims | undefined>;
}

/** Port of the token issuer: the kernel signs, other modules only ask. */
export interface CustomerTokenIssuer {
  issue(claims: CustomerTokenClaims): Promise<string>;
}

export interface CustomerTokenOptions {
  readonly secret: string;
  readonly clock: Clock;
}

/**
 * The customer's access token: audience `storefront`, `sub` the account and `org` the business that
 * issued it. The `org` claim is what keeps a login of one business from working at another (ADR-119).
 */
export function createCustomerTokenIssuer(
  options: CustomerTokenOptions & { readonly ttlSeconds: number },
): CustomerTokenIssuer {
  const key = secretToKey(options.secret);
  return {
    issue(claims: CustomerTokenClaims): Promise<string> {
      const issuedAt = Math.floor(options.clock.now().getTime() / MILLISECONDS_PER_SECOND);
      return new SignJWT({ [ORGANIZATION_CLAIM]: claims.organizationId })
        .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
        .setSubject(claims.customerAccountId)
        .setAudience(audienceClaim(TOKEN_AUDIENCE.STOREFRONT))
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + options.ttlSeconds)
        .sign(key);
    },
  };
}

/** HS256 verification with the storefront audience. Every failure (signature, expiry, audience, shape) is "not valid". */
export function createCustomerTokenVerifier(options: CustomerTokenOptions): CustomerTokenVerifier {
  const key = secretToKey(options.secret);
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ACCESS_TOKEN_ALGORITHM],
          audience: audienceClaim(TOKEN_AUDIENCE.STOREFRONT),
          currentDate: options.clock.now(),
          requiredClaims: ["sub", ORGANIZATION_CLAIM, "exp"],
        });
        const organizationId = payload[ORGANIZATION_CLAIM];
        if (typeof payload.sub !== "string" || typeof organizationId !== "string") return undefined;
        return { customerAccountId: payload.sub, organizationId };
      } catch (error) {
        if (error instanceof errors.JOSEError) return undefined;
        throw error;
      }
    },
  };
}
