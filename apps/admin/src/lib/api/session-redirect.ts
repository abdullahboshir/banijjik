import { buildSignInPath } from "../../auth/safe-next-path";

/** Sends the browser to the sign-in page and back to the current page afterwards. A no-op on the server. */
export function redirectToSignIn(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.location.assign(buildSignInPath(`${pathname}${search}`));
}
