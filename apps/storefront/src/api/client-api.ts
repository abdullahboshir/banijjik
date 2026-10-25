/**
 * Browser calls of the signed-in pages. They go through the storefront's own proxy (ADR-119), so the
 * browser sends the httpOnly cookies and never sees a token. The proxy keeps the path, the query and
 * the Idempotency-Key header.
 */
export const PROXY_API_PREFIX = "/api/v1/storefront";

export interface FieldProblem {
  readonly path: string;
  readonly messageKey: string;
}

export interface ClientResult<Data> {
  readonly ok: boolean;
  readonly status: number;
  readonly data: Data | undefined;
  readonly fields: readonly FieldProblem[];
}

export interface ClientCallOptions {
  readonly body?: unknown;
  readonly idempotencyKey?: string | undefined;
}

const HTTP_OK_MAX = 299;
const NO_FIELDS: readonly FieldProblem[] = [];

interface ErrorEnvelope {
  readonly error?: { readonly details?: { readonly fields?: readonly FieldProblem[] } };
}

function fieldsOf(json: unknown): readonly FieldProblem[] {
  const fields = (json as ErrorEnvelope | undefined)?.error?.details?.fields;
  return Array.isArray(fields) ? fields : NO_FIELDS;
}

function headersFor(options: ClientCallOptions): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey;
  return headers;
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // An answer without a JSON body (for example a 204) has no data; the status still tells the page.
    return undefined;
  }
}

/** One call through the proxy. The envelope's `data` is returned; the error fields are returned as-is. */
export async function callStorefront<Data>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: ClientCallOptions = {},
): Promise<ClientResult<Data>> {
  const init: RequestInit = { method, headers: headersFor(options), credentials: "same-origin" };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${PROXY_API_PREFIX}${path}`, init);
  const json = await jsonOf(response);
  const ok = response.status <= HTTP_OK_MAX;
  const data = ok ? (json as { data?: Data } | undefined)?.data : undefined;
  return { ok, status: response.status, data, fields: ok ? NO_FIELDS : fieldsOf(json) };
}
