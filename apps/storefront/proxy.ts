import { NextResponse, type NextRequest } from "next/server";
import { requestHeadersFor } from "./src/host/organization-header";
import { resolveHostOrganization } from "./src/host/storefront-host";

/**
 * Runs on every request (Next.js 16 calls this file `proxy.ts`). It resolves the Host to a business and
 * hands it to the pages and route handlers as a header. The client cannot set that header: it is
 * replaced here on every request (M.6 decision 9). Access and path rules live in the route handlers.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const organizationId = await resolveHostOrganization(request.headers.get("host") ?? "");
  return NextResponse.next({
    request: { headers: requestHeadersFor(request.headers, organizationId) },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
