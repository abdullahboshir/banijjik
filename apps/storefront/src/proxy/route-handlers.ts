import { headers } from "next/headers";
import { storefrontApiOrigin } from "../config/environment";
import { PUBLIC_FILES_API_PREFIX, STOREFRONT_API_PREFIX } from "../config/storefront-config";
import { organizationIdFrom } from "../host/organization-header";
import { forwardToApi, type ProxyContext, type ProxyRoute } from "./proxy-request";
import { isAllowedPublicFilePath, isAllowedStorefrontPath } from "./path-guard";

const BODYLESS_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

async function contextOf(request: Request): Promise<ProxyContext> {
  const body = BODYLESS_METHODS.has(request.method) ? undefined : await request.arrayBuffer();
  return {
    apiOrigin: storefrontApiOrigin(),
    method: request.method,
    search: new URL(request.url).search,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    headers: request.headers,
    body,
  };
}

/** `/api/v1/storefront/*`: only the resolved business's paths and the host lookup reach the API. */
export async function handleStorefrontApi(
  request: Request,
  path: readonly string[],
): Promise<Response> {
  const organizationId = organizationIdFrom(await headers());
  const route: ProxyRoute = {
    apiPrefix: STOREFRONT_API_PREFIX,
    segments: path,
    isAllowed: organizationId !== undefined && isAllowedStorefrontPath(path, organizationId),
  };
  return forwardToApi(await contextOf(request), route);
}

/** `/api/v1/public/files/*`: public files (the business logo) of the same business's host. */
export async function handlePublicFiles(
  request: Request,
  path: readonly string[],
): Promise<Response> {
  const route: ProxyRoute = {
    apiPrefix: PUBLIC_FILES_API_PREFIX,
    segments: path,
    isAllowed: isAllowedPublicFilePath(path),
  };
  return forwardToApi(await contextOf(request), route);
}
