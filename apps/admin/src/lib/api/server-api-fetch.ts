import "server-only";
import { ACCESS_TOKEN_COOKIE_NAME, ERROR_CODE, ERROR_HTTP_STATUS } from "@banijjik/contracts";
import { cookies } from "next/headers";
import { buildApiUrl } from "./api-url";
import { ApiError, networkError } from "./api-error";
import { parseApiResponse, type ApiResult } from "./parse-api-response";

export interface ServerApiRequestOptions {
  method?: "GET" | "PATCH";
  body?: unknown;
}

function missingSessionError(): ApiError {
  return new ApiError({
    status: ERROR_HTTP_STATUS.UNAUTHENTICATED,
    code: ERROR_CODE.UNAUTHENTICATED,
    messageKey: "errors.unauthenticated",
  });
}

function buildHeaders(accessToken: string, hasBody: boolean): Record<string, string> {
  // Only the access cookie is forwarded: the refresh cookie must never leave the browser-to-API path.
  const headers: Record<string, string> = {
    Accept: "application/json",
    Cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${accessToken}`,
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function sendServerRequest<Data, Meta>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<Data, Meta>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), init);
  } catch {
    throw networkError();
  }
  return parseApiResponse<Data, Meta>(response);
}

/**
 * Server components and server actions call the API with the visitor's access cookie, never cached
 * (the answer depends on who is asking). Without the cookie it fails as 401 without a request.
 */
export async function serverApiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
  options: ServerApiRequestOptions = {},
): Promise<ApiResult<Data, Meta>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!accessToken) throw missingSessionError();
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: buildHeaders(accessToken, options.body !== undefined),
    cache: "no-store",
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return sendServerRequest<Data, Meta>(path, init);
}

/** For public endpoints, such as the preview of an invitation link: no cookie is sent, none is needed. */
export function serverPublicApiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
): Promise<ApiResult<Data, Meta>> {
  return sendServerRequest<Data, Meta>(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
}
