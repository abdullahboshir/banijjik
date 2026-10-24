import { parseApiResponse } from "@banijjik/web-client";
import { cookies } from "next/headers";
import { storefrontApiOrigin } from "../config/environment";
import { PUBLIC_REVALIDATE_SECONDS, STOREFRONT_API_PREFIX } from "../config/storefront-config";
import { STOREFRONT_ACCESS_COOKIE_NAME } from "../session/storefront-cookies";

const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHENTICATED = 401;

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

/** Public, cacheable reads (site, pages, form, stats, listing number lookup): the same for everyone. */
export async function readPublic<Data>(path: string): Promise<Data | undefined> {
  const response = await sendGet(path, { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } });
  return envelopeData<Data>(response);
}

async function visitorAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(STOREFRONT_ACCESS_COOKIE_NAME)?.value;
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
