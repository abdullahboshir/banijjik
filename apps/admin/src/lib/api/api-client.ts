import { buildApiUrl } from "./api-url";
import { isUnauthenticatedError, networkError } from "./api-error";
import { parseApiResponse, type ApiResult } from "./parse-api-response";
import { refreshSession } from "./refresh-session";
import { redirectToSignIn } from "./session-redirect";

export type { ApiResult } from "./parse-api-response";

const IDEMPOTENCY_HEADER = "Idempotency-Key";
/** Sign-in, sign-up, refresh and sign-out answer 401 for their own reasons; renewing a session cannot fix those. */
const AUTH_PATH_PREFIX = "/auth/";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function buildRequestInit(options: ApiRequestOptions): RequestInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    // Cookies carry the session (ADR-010); nothing is kept in browser storage.
    credentials: "include",
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  if (options.signal) init.signal = options.signal;
  return init;
}

async function sendRequest<Data, Meta>(
  path: string,
  options: ApiRequestOptions,
): Promise<ApiResult<Data, Meta>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), buildRequestInit(options));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
  return parseApiResponse<Data, Meta>(response);
}

/** One renewal, then one retry. A second 401, or a renewal that fails, sends the person to sign in. */
async function retryAfterRenewal<Data, Meta>(
  path: string,
  options: ApiRequestOptions,
  firstError: unknown,
): Promise<ApiResult<Data, Meta>> {
  if (!(await refreshSession())) {
    redirectToSignIn();
    throw firstError;
  }
  try {
    return await sendRequest<Data, Meta>(path, options);
  } catch (error) {
    if (isUnauthenticatedError(error)) redirectToSignIn();
    throw error;
  }
}

/**
 * Calls the API from the browser and unwraps the `{ data, meta }` envelope; any failure becomes an ApiError.
 * A 401 on a non-auth path renews the session once (shared by parallel calls) and repeats the request.
 */
export async function apiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<Data, Meta>> {
  try {
    return await sendRequest<Data, Meta>(path, options);
  } catch (error) {
    const canRenew = isUnauthenticatedError(error) && !path.startsWith(AUTH_PATH_PREFIX);
    if (!canRenew) throw error;
    return retryAfterRenewal<Data, Meta>(path, options, error);
  }
}
