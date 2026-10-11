import { buildSessionRenewedCookie as buildMarkerCookie } from "@banijjik/web-client";

/**
 * Its own name: cookies are shared by every port of a host, and the admin app already uses `session_renewed`.
 * A marker from the other app must never switch this app's loop guard.
 */
export const PLATFORM_SESSION_RENEWED_COOKIE = "platform_session_renewed";

/** The loop-guard marker of the platform app (see @banijjik/web-client for what it is and why). */
export function buildSessionRenewedCookie(): string {
  return buildMarkerCookie(PLATFORM_SESSION_RENEWED_COOKIE);
}
