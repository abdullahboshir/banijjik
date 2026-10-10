import {
  ERROR_CODE,
  isErrorCode,
  type ApiErrorBody,
  type ApiSuccessEnvelope,
} from "@banijjik/contracts";
import { env } from "../../config/env";
import { ApiError, networkError } from "./api-error";

const API_PREFIX = "/api/v1";
const NO_CONTENT_STATUS = 204;
const IDEMPOTENCY_HEADER = "Idempotency-Key";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** What `apiFetch` resolves to; the same shape the API sends (14-API.md section 2). */
export type ApiResult<Data, Meta = Readonly<Record<string, unknown>>> = ApiSuccessEnvelope<
  Data,
  Meta
>;

/** Every field is optional here because the wire body is untrusted until it is checked. */
type ReceivedErrorBody = Partial<Omit<ApiErrorBody, "code">> & { code?: unknown };

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  // Safe: every field is optional and read defensively, so a body of any shape is handled.
  const failure = (body as { error?: ReceivedErrorBody } | undefined)?.error;
  return new ApiError({
    status,
    code: isErrorCode(failure?.code) ? failure.code : ERROR_CODE.INTERNAL,
    messageKey: failure?.messageKey ?? "errors.internal",
    details: failure?.details,
    requestId: failure?.requestId,
  });
}

function invalidResponse(status: number): ApiError {
  return new ApiError({
    status,
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.invalid_response",
  });
}

function hasData(body: unknown): boolean {
  return typeof body === "object" && body !== null && "data" in body;
}

async function sendRequest(path: string, options: ApiRequestOptions): Promise<Response> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}${API_PREFIX}${path}`;
  try {
    return await fetch(url, buildRequestInit(options));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
}

/**
 * Calls the API and unwraps the `{ data, meta }` envelope; any failure becomes an ApiError. A 2xx without
 * `data` is a broken response, except 204 No Content, which resolves to `{ data: undefined }` (use `apiFetch<void>`).
 */
export async function apiFetch<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<Data, Meta>> {
  const response = await sendRequest(path, options);
  if (response.status === NO_CONTENT_STATUS) {
    // Safe: only `apiFetch<void>` is meaningful for 204, and `undefined` is the value of `void`.
    return { data: undefined } as ApiResult<Data, Meta>;
  }
  const body = await readJson(response);
  if (!response.ok) throw toApiError(response.status, body);
  if (!hasData(body)) throw invalidResponse(response.status);
  // Safe by contract: a 2xx response from this API is always the { data, meta } envelope (14 §2).
  return body as ApiResult<Data, Meta>;
}
