import { NextResponse, type NextRequest } from "next/server";
import { requestHeadersFor } from "./src/host/organization-header";
import type { StorefrontHostResolution } from "./src/host/host-resolver";
import { resolveStorefrontHost } from "./src/host/storefront-host";

const RETRY_AFTER_SECONDS = "1";

/**
 * Runs on every request (Next.js 16 calls this file `proxy.ts`). It resolves the Host to a business and
 * hands it to the pages and route handlers as a header. The client cannot set that header: it is
 * replaced here on every request (M.6 decision 9). Access and path rules live in the route handlers.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let resolution: StorefrontHostResolution | undefined;
  try {
    resolution = await resolveStorefrontHost(request.headers.get("host") ?? "");
  } catch {
    return NextResponse.json(
      { error: { code: "RETRY_LATER", messageKey: "errors.retry_later" } },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": RETRY_AFTER_SECONDS } },
    );
  }
  const hostname = request.headers
    .get("host")
    ?.replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
  return NextResponse.next({
    request: {
      headers: requestHeadersFor(
        request.headers,
        resolution === undefined || hostname === undefined
          ? undefined
          : { organizationId: resolution.organizationId, hostname },
      ),
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
