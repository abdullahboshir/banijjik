import { logout } from "../api/platform-api";

/**
 * Ends the operator session on the API and loads the sign-in page afresh (a full page load also drops the
 * router's in-memory copies of private pages). Throws the ApiError when the API cannot be reached, so the
 * caller can tell the person and keep them signed in.
 */
export async function signOut(): Promise<void> {
  await logout();
  window.location.assign(new URL("/sign-in", window.location.origin));
}
