import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER } from "./src/auth/request-path";

/**
 * Hands the requested path to server components, so a layout that finds no session can send the person
 * to sign in and back to the page they asked for. The header is overwritten, never trusted from the client.
 */
export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
