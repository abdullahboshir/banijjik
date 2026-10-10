export interface ApiErrorFields {
  status: number;
  code: string;
  messageKey: string;
  details?: Readonly<Record<string, unknown>> | undefined;
  requestId?: string | undefined;
}

/** A failed API call, built from the error envelope of 14-API.md section 2. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly requestId: string | undefined;

  constructor(fields: ApiErrorFields) {
    super(`${fields.code}: ${fields.messageKey}`);
    this.name = "ApiError";
    this.status = fields.status;
    this.code = fields.code;
    this.messageKey = fields.messageKey;
    this.details = fields.details;
    this.requestId = fields.requestId;
  }
}

/** Status 0 marks a request that never reached the server (offline, DNS, CORS). */
export const NETWORK_ERROR_STATUS = 0;

export function networkError(): ApiError {
  return new ApiError({
    status: NETWORK_ERROR_STATUS,
    code: "INTERNAL",
    messageKey: "errors.network",
  });
}
