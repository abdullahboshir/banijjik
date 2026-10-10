import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER } from "./src/auth/request-path";
import { SESSION_RENEWED_COOKIE } from "./src/auth/session-renewed-marker";

const SIGN_IN_PATH = "/sign-in";

/**
 * Hands the requested path to server components, so a layout that finds no session can send the person
 * to sign in and back to the page they asked for. The header is overwritten, never trusted from the client.
 */
export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.next({ request: { headers } });
  // Server components cannot delete cookies, so the loop-guard marker is cleared here once its round is over.
  if (request.nextUrl.pathname === SIGN_IN_PATH) response.cookies.delete(SESSION_RENEWED_COOKIE);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
