export const SESSION_RENEWED_COOKIE = "session_renewed";
const MARKER_MAX_AGE_SECONDS = 15;

/**
 * Value for `document.cookie` that tells the server "a renewal just worked". It is not httpOnly on purpose:
 * the browser page sets it, and it only carries a yes, never a secret. If the access cookie still does not
 * reach the server within these seconds, the server stops sending the person back to /session (loop guard).
 */
export function buildSessionRenewedCookie(): string {
  return `${SESSION_RENEWED_COOKIE}=1; Max-Age=${MARKER_MAX_AGE_SECONDS}; SameSite=Lax; Path=/`;
}
