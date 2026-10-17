import { isUnauthenticatedError, networkError } from "./api-error.js";
import { parseApiResponse, type ApiResult } from "./parse-api-response.js";

export type { ApiResult } from "./parse-api-response.js";

const IDEMPOTENCY_HEADER = "Idempotency-Key";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON-encoded, except a FormData body, which is sent as multipart and gets its boundary from the browser. */
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiClientConfig {
  /** Origin of the API, without a trailing slash. */
  baseUrl: string;
  /** Path prefix of the API version, such as `/api/v1`. */
  apiPrefix: string;
  /** API path (without the prefix) that renews the session from the refresh cookie. */
  refreshPath: string;
  /**
   * Sign-in, sign-up, refresh and sign-out answer 401 for their own reasons; renewing a session cannot fix
   * those. API paths that start with this prefix are never renewed or retried.
   */
  authPathPrefix: string;
  /** Called when the session cannot be renewed: sends the person to sign in. */
  onSessionLost: () => void;
}

export type ApiFetch = <Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
  options?: ApiRequestOptions,
) => Promise<ApiResult<Data, Meta>>;

export interface ApiClient {
  apiFetch: ApiFetch;
  /**
   * Asks the API for a new access cookie. Callers that arrive while a renewal is running share its result, so
   * parallel 401s cost one refresh: the refresh token rotates and a second use would count as reuse.
   * Resolves false when the refresh cookie is missing, expired or revoked.
   */
  refreshSession: () => Promise<boolean>;
}

function buildRequestInit(options: ApiRequestOptions): RequestInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    // Cookies carry the session (ADR-010); nothing is kept in browser storage.
    credentials: "include",
  };
  if (options.body instanceof FormData) init.body = options.body;
  else if (options.body !== undefined) init.body = JSON.stringify(options.body);
  if (options.signal) init.signal = options.signal;
  return init;
}

async function sendRequest<Data, Meta>(
  url: string,
  options: ApiRequestOptions,
): Promise<ApiResult<Data, Meta>> {
  let response: Response;
  try {
    response = await fetch(url, buildRequestInit(options));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
  return parseApiResponse<Data, Meta>(response);
}

async function requestRenewal(refreshUrl: string): Promise<boolean> {
  try {
    // Only the refresh cookie matters here; it is sent because credentials are included (ADR-010).
    const response = await fetch(refreshUrl, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    throw networkError();
  }
}

/** One API client for one audience: its own URLs, its own refresh path, and its own single renewal in flight. */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const buildUrl = (path: string): string => `${config.baseUrl}${config.apiPrefix}${path}`;
  let renewalInFlight: Promise<boolean> | undefined;

  function refreshSession(): Promise<boolean> {
    renewalInFlight ??= requestRenewal(buildUrl(config.refreshPath)).finally(() => {
      renewalInFlight = undefined;
    });
    return renewalInFlight;
  }

  /** One renewal, then one retry. A second 401, or a renewal that fails, sends the person to sign in. */
  async function retryAfterRenewal<Data, Meta>(
    path: string,
    options: ApiRequestOptions,
    firstError: unknown,
  ): Promise<ApiResult<Data, Meta>> {
    if (!(await refreshSession())) {
      config.onSessionLost();
      throw firstError;
    }
    try {
      return await sendRequest<Data, Meta>(buildUrl(path), options);
    } catch (error) {
      if (isUnauthenticatedError(error)) config.onSessionLost();
      throw error;
    }
  }

  /**
   * Calls the API from the browser and unwraps the `{ data, meta }` envelope; any failure becomes an ApiError.
   * A 401 on a non-auth path renews the session once (shared by parallel calls) and repeats the request.
   */
  async function apiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResult<Data, Meta>> {
    try {
      return await sendRequest<Data, Meta>(buildUrl(path), options);
    } catch (error) {
      const canRenew = isUnauthenticatedError(error) && !path.startsWith(config.authPathPrefix);
      if (!canRenew) throw error;
      return retryAfterRenewal<Data, Meta>(path, options, error);
    }
  }

  return { apiFetch, refreshSession };
}
