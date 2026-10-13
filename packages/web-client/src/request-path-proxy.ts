import { NextResponse, type NextRequest } from "next/server.js";
import { REQUEST_PATH_HEADER } from "./request-path.js";

const SIGN_IN_PATH = "/sign-in";

/**
 * Builds the app's `proxy` function. It hands the requested path to server components, so a layout that
 * finds no session can send the person to sign in and back to the page they asked for. The header is
 * overwritten, never trusted from the client. `renewedCookieName` is the app's own loop-guard marker.
 */
export function createRequestPathProxy(renewedCookieName: string) {
  return function proxy(request: NextRequest): NextResponse {
    const headers = new Headers(request.headers);
    headers.set(REQUEST_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.next({ request: { headers } });
    // Server components cannot delete cookies, so the loop-guard marker is cleared here once its round is over.
    if (request.nextUrl.pathname === SIGN_IN_PATH) response.cookies.delete(renewedCookieName);
    return response;
  };
}
