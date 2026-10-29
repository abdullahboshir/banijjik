import { NextResponse, type NextRequest } from "next/server";
import { requestHeadersFor } from "./src/host/organization-header";
import type { StorefrontHostResolution } from "./src/host/host-resolver";
import { resolveStorefrontHost } from "./src/host/storefront-host";

const RETRY_AFTER_SECONDS = "1";

function parseRequestHostname(hostHeader: string | null): string | undefined {
  if (hostHeader === null) return undefined;
  return hostHeader.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
}

/**
 * Runs on every request. It resolves the Host to a business and hands the full authoritative
 * host resolution (organizationId, hostname, canonicalHostname, publishedWebsiteVersionId, generation)
 * to pages and route handlers via trusted headers.
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

  const hostname = parseRequestHostname(request.headers.get("host"));
  const trustedResolution =
    resolution === undefined || hostname === undefined
      ? undefined
      : {
          organizationId: resolution.organizationId,
          hostname: resolution.hostname ?? hostname,
          generation: resolution.generation,
          canonicalHostname: resolution.canonicalHostname,
          publishedWebsiteVersionId: resolution.publishedWebsiteVersionId,
        };

  return NextResponse.next({
    request: {
      headers: requestHeadersFor(request.headers, trustedResolution),
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
