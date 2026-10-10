import { ACCESS_TOKEN_COOKIE_NAME, type TokenAudience } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { readCookie, unauthenticated } from "../http/index.js";
import type { AccessTokenVerifier } from "./access-token-verifier.js";

export interface AuthenticateOptions {
  readonly audience: TokenAudience;
  readonly verifier: AccessTokenVerifier;
}

/**
 * Reads the access cookie, checks signature, expiry and audience, and continues with `userId` in
 * the request context. It does not touch the database: a revoked session stops working when its
 * access token expires (15 minutes), or at once on the device that logged out (ADR-048).
 */
export function authenticate(options: AuthenticateOptions): RequestHandler {
  return async (request, _response, next) => {
    const token = readCookie(request, ACCESS_TOKEN_COOKIE_NAME);
    if (token === undefined) throw unauthenticated();
    const verified = await options.verifier.verify(token, options.audience);
    if (verified === undefined) throw unauthenticated();
    runWithRequestContext({ ...getRequestContext(), userId: verified.userId }, () => next());
  };
}
