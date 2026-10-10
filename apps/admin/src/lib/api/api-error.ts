import { ERROR_CODE, ERROR_HTTP_STATUS, type ErrorCode } from "@banijjik/contracts";

export interface ApiErrorFields {
  status: number;
  code: ErrorCode;
  messageKey: string;
  details?: Readonly<Record<string, unknown>> | undefined;
  requestId?: string | undefined;
  /** From the `Retry-After` header of a 429; absent when the browser may not read it. */
  retryAfterSeconds?: number | undefined;
}

/** A failed API call, built from the error envelope of 14-API.md section 2. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly requestId: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(fields: ApiErrorFields) {
    super(`${fields.code}: ${fields.messageKey}`);
    this.name = "ApiError";
    this.status = fields.status;
    this.code = fields.code;
    this.messageKey = fields.messageKey;
    this.details = fields.details;
    this.requestId = fields.requestId;
    this.retryAfterSeconds = fields.retryAfterSeconds;
  }
}

/** Status 0 marks a request that never reached the server (offline, DNS, CORS). */
export const NETWORK_ERROR_STATUS = 0;

export function networkError(): ApiError {
  return new ApiError({
    status: NETWORK_ERROR_STATUS,
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.network",
  });
}

export function isUnauthenticatedError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === ERROR_HTTP_STATUS.UNAUTHENTICATED &&
    error.code === ERROR_CODE.UNAUTHENTICATED
  );
}
