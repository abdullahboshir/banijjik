import { STOREFRONT_API_PREFIX } from "../config/storefront-config";
import {
  STOREFRONT_ACCESS_COOKIE_NAME,
  STOREFRONT_REFRESH_COOKIE_NAME,
  valueFromSetCookie,
} from "./storefront-cookies";

export interface RenewedSession {
  /** The new access token, so the page being rendered already sees the signed-in customer. */
  readonly accessToken: string;
  /** Every `Set-Cookie` line of the API answer, for the browser. */
  readonly setCookieLines: readonly string[];
}

export interface RenewAccessInput {
  readonly apiOrigin: string;
  readonly organizationId: string;
  readonly refreshToken: string;
  readonly fetchImpl?: typeof fetch;
}

function refreshUrl(input: RenewAccessInput): string {
  return `${input.apiOrigin}${STOREFRONT_API_PREFIX}/orgs/${input.organizationId}/auth/refresh`;
}

function accessTokenOf(setCookieLines: readonly string[]): string | undefined {
  for (const line of setCookieLines) {
    const value = valueFromSetCookie(line, STOREFRONT_ACCESS_COOKIE_NAME);
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/**
 * Asks the API for a new access cookie with the refresh cookie (ADR-119). Called by the proxy once for a
 * page whose access cookie is gone. A refused refresh (expired or revoked) answers undefined: the page
 * then renders as signed out.
 */
export async function renewAccessToken(
  input: RenewAccessInput,
): Promise<RenewedSession | undefined> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(refreshUrl(input), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: `${STOREFRONT_REFRESH_COOKIE_NAME}=${input.refreshToken}`,
    },
    redirect: "manual",
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  const setCookieLines = response.headers.getSetCookie();
  const accessToken = accessTokenOf(setCookieLines);
  if (accessToken === undefined) return undefined;
  return { accessToken, setCookieLines };
}
