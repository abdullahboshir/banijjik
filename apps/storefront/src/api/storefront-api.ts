import { parseApiResponse } from "@banijjik/web-client";
import { cookies } from "next/headers";
import { storefrontApiOrigin } from "../config/environment";
import { STOREFRONT_API_PREFIX } from "../config/storefront-config";
import { STOREFRONT_ACCESS_COOKIE_NAME } from "../session/storefront-cookies";
import { currentSiteResolution } from "../site/current-site";
import { buildPublicCacheKey, publicProjectionCache } from "../site/public-cache";

const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHENTICATED = 401;
const HTTP_OK = 200;
const LOCALE_COOKIE_NAME = "locale";
const DEFAULT_LOCALE = "bn";

/**
 * Server-side reads of the storefront API (server components only). Shared rule: a 404 is answered as
 * undefined so the page can call notFound(); any other failure throws and reaches the error page.
 */
async function envelopeData<Data>(response: Response): Promise<Data | undefined> {
  if (response.status === HTTP_NOT_FOUND) return undefined;
  const envelope = await parseApiResponse<Data>(response);
  return envelope.data;
}

function sendGet(path: string, init: RequestInit): Promise<Response> {
  const url = `${storefrontApiOrigin()}${STOREFRONT_API_PREFIX}${path}`;
  return fetch(url, { ...init, headers: { Accept: "application/json", ...init.headers } });
}

function isPublicCacheable(cacheControl: string | null): boolean {
  if (cacheControl === null) return false;
  const lower = cacheControl.toLowerCase();
  return lower.includes("public") && !lower.includes("private") && !lower.includes("no-store");
}

function parsePathAndQuery(path: string): {
  readonly pathname: string;
  readonly query?: URLSearchParams | undefined;
} {
  const [pathname, search] = path.split("?", 2);
  const query = search ? new URLSearchParams(search) : undefined;
  return { pathname: pathname ?? path, query };
}

async function currentRequestLocale(): Promise<string> {
  try {
    const jar = await cookies();
    return jar.get(LOCALE_COOKIE_NAME)?.value || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Authoritative public projection reads (site, pages, form, stats).
 * Checks the authoritative host resolution before consulting the cache.
 * Refuses cache hits when host resolution is absent (P4-11).
 * Never caches Set-Cookie, private, no-store or error responses.
 */
export async function readPublic<Data>(path: string): Promise<Data | undefined> {
  const resolution = await currentSiteResolution();
  if (resolution === undefined) {
    const response = await sendGet(path, { cache: "no-store" });
    return envelopeData<Data>(response);
  }

  const locale = await currentRequestLocale();
  const { pathname, query } = parsePathAndQuery(path);
  const cacheKey = buildPublicCacheKey({
    organizationId: resolution.organizationId,
    websiteVersionId: resolution.publishedWebsiteVersionId,
    locale,
    locationId: "all",
    projection: pathname,
    query,
  });

  const cached = publicProjectionCache.get<Data>(cacheKey);
  if (cached !== undefined) return cached;

  const response = await sendGet(path, { cache: "no-store" });
  const isCacheable =
    response.status === HTTP_OK &&
    isPublicCacheable(response.headers.get("cache-control")) &&
    response.headers.getSetCookie().length === 0;

  const data = await envelopeData<Data>(response);
  if (isCacheable && data !== undefined) {
    publicProjectionCache.set(cacheKey, data, {
      organizationId: resolution.organizationId,
      websiteVersionId: resolution.publishedWebsiteVersionId,
    });
  }
  return data;
}

async function visitorAccessToken(): Promise<string | undefined> {
  try {
    const jar = await cookies();
    return jar.get(STOREFRONT_ACCESS_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Reads that depend on who is asking (search, a listing with the member's fields): the visitor's access
 * cookie is forwarded and nothing is cached. An expired or refused cookie falls back to the public view,
 * so a stale sign-in never breaks a public page.
 */
export async function readAsVisitor<Data>(path: string): Promise<Data | undefined> {
  const accessToken = await visitorAccessToken();
  if (accessToken === undefined) {
    return envelopeData<Data>(await sendGet(path, { cache: "no-store" }));
  }
  const signedIn = await sendGet(path, {
    cache: "no-store",
    headers: { Cookie: `${STOREFRONT_ACCESS_COOKIE_NAME}=${accessToken}` },
  });
  if (signedIn.status !== HTTP_UNAUTHENTICATED) return envelopeData<Data>(signedIn);
  return envelopeData<Data>(await sendGet(path, { cache: "no-store" }));
}

/** The signed-in customer's own read (`GET /me`): no cookie or a refused one means signed out (undefined). */
export async function readSignedInCustomer<Data>(path: string): Promise<Data | undefined> {
  const accessToken = await visitorAccessToken();
  if (accessToken === undefined) return undefined;
  const response = await sendGet(path, {
    cache: "no-store",
    headers: { Cookie: `${STOREFRONT_ACCESS_COOKIE_NAME}=${accessToken}` },
  });
  if (response.status === HTTP_UNAUTHENTICATED) return undefined;
  return envelopeData<Data>(response);
}
