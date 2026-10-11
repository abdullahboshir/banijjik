import type { QueryClient } from "@tanstack/react-query";
import { logout } from "../lib/api/auth-api";
import { buildSignInPath } from "./safe-next-path";

const SIGN_IN_PATH = "/sign-in";

/**
 * Ends the session on the API, drops everything cached for this person and loads the sign-in page afresh.
 * `returnTo` (a same-origin path) brings the person back there after signing in again.
 * Throws the ApiError when the API cannot be reached, so the caller can tell the person and keep them signed in.
 */
export async function signOut(queryClient: QueryClient, returnTo?: string): Promise<void> {
  await logout();
  queryClient.clear();
  const target = returnTo === undefined ? SIGN_IN_PATH : buildSignInPath(returnTo);
  // A full page load, not a router push: it also drops the router's in-memory copies of private pages.
  window.location.assign(new URL(target, window.location.origin));
}
