import {
  buildSessionRenewalPath,
  buildSessionUnavailablePath,
  safeNextPath,
} from "./safe-next-path";

/**
 * Where a visitor without a valid session goes. Normally to /session for one silent renewal; when a renewal
 * just succeeded yet the server still sees no session (the browser does not deliver the access cookie), to
 * sign-in with a reason instead, because another round would loop.
 */
export function sessionGuardTarget(
  requestedPath: string | null,
  hasRenewedMarker: boolean,
): string {
  const nextPath = safeNextPath(requestedPath);
  return hasRenewedMarker
    ? buildSessionUnavailablePath(nextPath)
    : buildSessionRenewalPath(nextPath);
}
