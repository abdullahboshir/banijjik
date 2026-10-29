import { ORGANIZATION_HEADER } from "../config/storefront-config";

/**
 * The request headers a page or route sees: the client's copy with the organization header replaced by
 * the one the Host resolved to (or removed for an unknown host). A client can never supply it (M.6 decision 9).
 */
export function requestHeadersFor(
  source: Headers,
  resolution: { readonly organizationId: string; readonly hostname: string } | undefined,
): Headers {
  const headers = new Headers(source);
  headers.delete(ORGANIZATION_HEADER);
  headers.delete("x-forwarded-host");
  if (resolution !== undefined) {
    headers.set(ORGANIZATION_HEADER, resolution.organizationId);
    headers.set("x-forwarded-host", resolution.hostname);
  }
  return headers;
}

/** The business the current request is for, from the header the proxy set; undefined for an unknown host. */
export function organizationIdFrom(headers: Headers): string | undefined {
  const value = headers.get(ORGANIZATION_HEADER);
  return value === null || value === "" ? undefined : value;
}
