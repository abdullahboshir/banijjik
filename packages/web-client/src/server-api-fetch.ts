import "server-only";
import { ERROR_CODE, ERROR_HTTP_STATUS } from "@banijjik/contracts";
import { cookies } from "next/headers.js";
import { ApiError, networkError } from "./api-error.js";
import { parseApiResponse, type ApiResult } from "./parse-api-response.js";

export interface ServerApiRequestOptions {
  method?: "GET" | "PATCH";
  body?: unknown;
}

export interface ServerApiConfig {
  /** Origin of the API, without a trailing slash. */
  baseUrl: string;
  /** Path prefix of the API version, such as `/api/v1`. */
  apiPrefix: string;
  /** The one cookie that is forwarded to the API on behalf of the visitor. */
  accessCookieName: string;
}

export interface ServerApi {
  serverApiFetch: <Data, Meta = Readonly<Record<string, unknown>>>(
    path: string,
    options?: ServerApiRequestOptions,
  ) => Promise<ApiResult<Data, Meta>>;
  serverPublicApiFetch: <Data, Meta = Readonly<Record<string, unknown>>>(
    path: string,
  ) => Promise<ApiResult<Data, Meta>>;
}

function missingSessionError(): ApiError {
  return new ApiError({
    status: ERROR_HTTP_STATUS.UNAUTHENTICATED,
    code: ERROR_CODE.UNAUTHENTICATED,
    messageKey: "errors.unauthenticated",
  });
}

async function sendServerRequest<Data, Meta>(
  url: string,
  init: RequestInit,
): Promise<ApiResult<Data, Meta>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw networkError();
  }
  return parseApiResponse<Data, Meta>(response);
}

function buildHeaders(
  accessCookieName: string,
  accessToken: string,
  hasBody: boolean,
): Record<string, string> {
  // Only the access cookie is forwarded: the refresh cookie must never leave the browser-to-API path.
  const headers: Record<string, string> = {
    Accept: "application/json",
    Cookie: `${accessCookieName}=${accessToken}`,
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

/**
 * Server components and server actions call the API with the visitor's access cookie, never cached
 * (the answer depends on who is asking). Without the cookie it fails as 401 without a request.
 */
export function createServerApiFetch(config: ServerApiConfig): ServerApi {
  const buildUrl = (path: string): string => `${config.baseUrl}${config.apiPrefix}${path}`;

  async function serverApiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
    path: string,
    options: ServerApiRequestOptions = {},
  ): Promise<ApiResult<Data, Meta>> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(config.accessCookieName)?.value;
    if (!accessToken) throw missingSessionError();
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers: buildHeaders(config.accessCookieName, accessToken, options.body !== undefined),
      cache: "no-store",
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    return sendServerRequest<Data, Meta>(buildUrl(path), init);
  }

  /** For public endpoints, such as the preview of an invitation link: no cookie is sent, none is needed. */
  function serverPublicApiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
    path: string,
  ): Promise<ApiResult<Data, Meta>> {
    return sendServerRequest<Data, Meta>(buildUrl(path), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  }

  return { serverApiFetch, serverPublicApiFetch };
}
