import "server-only";
import { ERROR_HTTP_STATUS, type PlatformMeResponse } from "@banijjik/contracts";
import { ApiError, REQUEST_PATH_HEADER, sessionGuardTarget } from "@banijjik/web-client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverApiFetch } from "../api/platform-server-api";
import { PLATFORM_SESSION_RENEWED_COOKIE } from "./session-renewed-marker";

async function redirectToSessionRenewal(): Promise<never> {
  const requestedPath = (await headers()).get(REQUEST_PATH_HEADER);
  const hasRenewedMarker = (await cookies()).has(PLATFORM_SESSION_RENEWED_COOKIE);
  return redirect(sessionGuardTarget(requestedPath, hasRenewedMarker));
}

/**
 * Runs a server-side load; if the API says the visitor has no valid operator session, the visitor is sent to
 * /session (one silent renewal in the browser) and from there to sign-in, coming back to the page they asked for.
 */
export async function requireOperatorSession<Result>(load: () => Promise<Result>): Promise<Result> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.UNAUTHENTICATED)
      return redirectToSessionRenewal();
    throw error;
  }
}

/**
 * The signed-in operator with roles and permissions, read from the API on every request (the operator row is
 * re-checked there), once per request however many components ask.
 */
export const loadOperator = cache((): Promise<PlatformMeResponse> =>
  requireOperatorSession(
    async () => (await serverApiFetch<PlatformMeResponse>("/platform/me")).data,
  ),
);
