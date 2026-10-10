import {
  PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
  TOKEN_AUDIENCE,
  type PlatformRole,
} from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { readCookie, unauthenticated } from "../http/index.js";
import type { AccessTokenVerifier } from "./access-token-verifier.js";

export interface ActivePlatformOperator {
  readonly platformOperatorId: string;
  readonly platformRoles: readonly PlatformRole[];
}

/** Port of the kernel, implemented by iam: the operator record of a user, if it is ACTIVE. */
export interface PlatformOperatorLookup {
  findActiveOperator(userId: string): Promise<ActivePlatformOperator | undefined>;
}

export interface AuthenticatePlatformOptions {
  readonly verifier: AccessTokenVerifier;
  readonly operators: PlatformOperatorLookup;
}

/**
 * Reads the platform access cookie, checks the token for the PLATFORM audience, then loads the
 * operator. Unlike the admin `authenticate`, it reads one indexed row per request: operator
 * traffic is tiny, and a disabled operator must stop working at once, not after 15 minutes
 * (plan 1.8a decision 2). Every failure is the same 401.
 */
export function authenticatePlatform(options: AuthenticatePlatformOptions): RequestHandler {
  return async (request, _response, next) => {
    const token = readCookie(request, PLATFORM_ACCESS_TOKEN_COOKIE_NAME);
    if (token === undefined) throw unauthenticated();
    const verified = await options.verifier.verify(token, TOKEN_AUDIENCE.PLATFORM);
    if (verified === undefined) throw unauthenticated();
    const operator = await options.operators.findActiveOperator(verified.userId);
    if (operator === undefined) throw unauthenticated();
    runWithRequestContext(
      {
        ...getRequestContext(),
        userId: verified.userId,
        platformOperatorId: operator.platformOperatorId,
        platformRoles: operator.platformRoles,
      },
      () => next(),
    );
  };
}
