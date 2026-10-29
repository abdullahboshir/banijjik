import { ORGANIZATION_HEADER } from "../config/storefront-config";

export const STOREFRONT_ORGANIZATION_HEADER = ORGANIZATION_HEADER;
export const STOREFRONT_FORWARDED_HOST_HEADER = "x-forwarded-host";
export const STOREFRONT_CANONICAL_HOST_HEADER = "x-storefront-canonical-host";
export const STOREFRONT_VERSION_HEADER = "x-storefront-website-version-id";
export const STOREFRONT_GENERATION_HEADER = "x-storefront-domain-generation";

export interface TrustedHostResolution {
  readonly organizationId: string;
  readonly hostname: string;
  readonly generation: number;
  readonly canonicalHostname: string;
  readonly publishedWebsiteVersionId: string;
}

const CONTROLLED_HEADERS = [
  STOREFRONT_ORGANIZATION_HEADER,
  STOREFRONT_FORWARDED_HOST_HEADER,
  STOREFRONT_CANONICAL_HOST_HEADER,
  STOREFRONT_VERSION_HEADER,
  STOREFRONT_GENERATION_HEADER,
] as const;

/**
 * Replaces client-supplied host and tenant identity headers with trusted resolution values.
 * On unknown hosts, client-supplied headers are stripped completely.
 */
export function requestHeadersFor(
  source: Headers,
  resolution: TrustedHostResolution | undefined,
): Headers {
  const headers = new Headers(source);
  for (const name of CONTROLLED_HEADERS) {
    headers.delete(name);
  }
  if (resolution !== undefined) {
    headers.set(STOREFRONT_ORGANIZATION_HEADER, resolution.organizationId);
    headers.set(STOREFRONT_FORWARDED_HOST_HEADER, resolution.hostname);
    headers.set(STOREFRONT_CANONICAL_HOST_HEADER, resolution.canonicalHostname);
    headers.set(STOREFRONT_VERSION_HEADER, resolution.publishedWebsiteVersionId);
    headers.set(STOREFRONT_GENERATION_HEADER, String(resolution.generation));
  }
  return headers;
}

/** The business the current request is for, from the header the proxy set; undefined for an unknown host. */
export function organizationIdFrom(headers: Headers): string | undefined {
  const value = headers.get(STOREFRONT_ORGANIZATION_HEADER);
  return value === null || value === "" ? undefined : value;
}

/** Reads the single authoritative host resolution stamped by the proxy. */
export function storefrontResolutionFrom(headers: Headers): TrustedHostResolution | undefined {
  const organizationId = headers.get(STOREFRONT_ORGANIZATION_HEADER);
  const hostname = headers.get(STOREFRONT_FORWARDED_HOST_HEADER);
  const canonicalHostname = headers.get(STOREFRONT_CANONICAL_HOST_HEADER);
  const publishedWebsiteVersionId = headers.get(STOREFRONT_VERSION_HEADER);
  const rawGeneration = headers.get(STOREFRONT_GENERATION_HEADER);

  if (
    organizationId === null ||
    hostname === null ||
    canonicalHostname === null ||
    publishedWebsiteVersionId === null ||
    rawGeneration === null
  ) {
    return undefined;
  }
  const generation = Number.parseInt(rawGeneration, 10);
  if (!Number.isInteger(generation)) return undefined;

  return {
    organizationId,
    hostname,
    generation,
    canonicalHostname,
    publishedWebsiteVersionId,
  };
}
