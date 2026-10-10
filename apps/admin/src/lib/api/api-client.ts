import { env } from "../../config/env";
import { ApiError, networkError } from "./api-error";

const API_PREFIX = "/api/v1";
const IDEMPOTENCY_HEADER = "Idempotency-Key";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiResult<Data, Meta = Record<string, unknown>> {
  data: Data;
  meta?: Meta;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    messageKey?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const failure = (body as ErrorEnvelope | undefined)?.error;
  return new ApiError({
    status,
    code: failure?.code ?? "INTERNAL",
    messageKey: failure?.messageKey ?? "errors.internal",
    details: failure?.details,
    requestId: failure?.requestId,
  });
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

/** Calls the API and unwraps the `{ data, meta }` envelope; any failure becomes an ApiError. */
export async function apiFetch<Data, Meta = Record<string, unknown>>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<Data, Meta>> {
  const response = await sendRequest(path, options);
  const body = await readJson(response);
  if (!response.ok) throw toApiError(response.status, body);
  return body as ApiResult<Data, Meta>;
}
