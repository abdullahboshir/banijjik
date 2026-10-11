import {
  ERROR_CODE,
  isErrorCode,
  type ApiErrorBody,
  type ApiSuccessEnvelope,
} from "@banijjik/contracts";
import { ApiError } from "./api-error.js";

const NO_CONTENT_STATUS = 204;
const RETRY_AFTER_HEADER = "Retry-After";

/** What a call resolves to; the same shape the API sends (14-API.md section 2). */
export type ApiResult<Data, Meta = Readonly<Record<string, unknown>>> = ApiSuccessEnvelope<
  Data,
  Meta
>;

/** Every field is optional here because the wire body is untrusted until it is checked. */
type ReceivedErrorBody = Partial<Omit<ApiErrorBody, "code">> & { code?: unknown };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Whole seconds from a `Retry-After` header; a date value or garbage gives undefined. */
function readRetryAfterSeconds(response: Response): number | undefined {
  const seconds = Number(response.headers.get(RETRY_AFTER_HEADER));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function toApiError(response: Response, body: unknown): ApiError {
  // Safe: every field is optional and read defensively, so a body of any shape is handled.
  const failure = (body as { error?: ReceivedErrorBody } | undefined)?.error;
  return new ApiError({
    status: response.status,
    code: isErrorCode(failure?.code) ? failure.code : ERROR_CODE.INTERNAL,
    messageKey: failure?.messageKey ?? "errors.internal",
    details: failure?.details,
    requestId: failure?.requestId,
    retryAfterSeconds: readRetryAfterSeconds(response),
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

/**
 * Unwraps the `{ data, meta }` envelope; any failure becomes an ApiError. A 2xx without `data` is a broken
 * response, except 204 No Content, which resolves to `{ data: undefined }` (use `<void>`).
 */
export async function parseApiResponse<Data, Meta = Readonly<Record<string, unknown>>>(
  response: Response,
): Promise<ApiResult<Data, Meta>> {
  if (response.status === NO_CONTENT_STATUS) {
    // Safe: only `<void>` is meaningful for 204, and `undefined` is the value of `void`.
    return { data: undefined } as ApiResult<Data, Meta>;
  }
  const body = await readJson(response);
  if (!response.ok) throw toApiError(response, body);
  if (!hasData(body)) throw invalidResponse(response.status);
  // Safe by contract: a 2xx response from this API is always the { data, meta } envelope (14 §2).
  return body as ApiResult<Data, Meta>;
}
