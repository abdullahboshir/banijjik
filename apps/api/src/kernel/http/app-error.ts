import { ERROR_CODE, ERROR_HTTP_STATUS, type ErrorCode } from "@banijjik/contracts";

export interface ErrorDetails {
  readonly [key: string]: unknown;
}

export interface ValidationField {
  readonly path: string;
  readonly messageKey: string;
}

export interface AppErrorOptions {
  readonly code: ErrorCode;
  readonly messageKey?: string;
  readonly details?: ErrorDetails;
}

/** The only error type that reaches a client with its code. Anything else becomes INTERNAL. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly details?: ErrorDetails;

  constructor(options: AppErrorOptions) {
    const messageKey = options.messageKey ?? `errors.${options.code.toLowerCase()}`;
    // The message is for logs only; responses are built from code, messageKey and details.
    super(`${options.code}: ${messageKey}`);
    this.name = "AppError";
    this.code = options.code;
    this.messageKey = messageKey;
    if (options.details !== undefined) this.details = options.details;
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }
}

export function notFound(): AppError {
  return new AppError({ code: ERROR_CODE.NOT_FOUND });
}

export function forbidden(): AppError {
  return new AppError({ code: ERROR_CODE.FORBIDDEN });
}

export function conflict(details: ErrorDetails): AppError {
  return new AppError({ code: ERROR_CODE.CONFLICT, details });
}

export function validationFailed(fields: readonly ValidationField[]): AppError {
  return new AppError({ code: ERROR_CODE.VALIDATION_ERROR, details: { fields } });
}
