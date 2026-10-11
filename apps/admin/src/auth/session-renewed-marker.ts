import { buildSessionRenewedCookie as buildMarkerCookie } from "@banijjik/web-client";

export const SESSION_RENEWED_COOKIE = "session_renewed";

/** The loop-guard marker of the admin app (see @banijjik/web-client for what it is and why). */
export function buildSessionRenewedCookie(): string {
  return buildMarkerCookie(SESSION_RENEWED_COOKIE);
}
