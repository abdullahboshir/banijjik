/**
 * Values the storefront shares across its server code. Kept in one file so a test can read the names
 * the proxy and the pages agree on.
 */

/** Set by the proxy from the Host header; the only source of the business a page or route serves. */
export const ORGANIZATION_HEADER = "x-storefront-organization-id";

/** How long a host answer (positive or negative) is reused in memory (M.6 decision 9). */
export const HOST_CACHE_TTL_MS = 60_000;

/** A proxied API call that takes longer than this is answered 504 (the API is down or stuck). */
export const UPSTREAM_TIMEOUT_MS = 15_000;

/** Public reads are answered from the Next.js data cache for this long (14-API section 6). */
export const PUBLIC_REVALIDATE_SECONDS = 60;

export const STOREFRONT_API_PREFIX = "/api/v1/storefront";
export const PUBLIC_FILES_API_PREFIX = "/api/v1/public/files";
