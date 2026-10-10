import type { ErrorCode } from "./error-code.js";

export interface DomainRuleErrorOptions {
  readonly code: ErrorCode;
  readonly messageKey?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  /** Sent as the Retry-After header, for 429 answers. */
  readonly retryAfterSeconds?: number;
}

/**
 * A business rule that failed. Domain code throws this (or a subclass) with a contracts error code
 * and a message key; the kernel error handler maps it to the API answer like an AppError (ADR-086).
 * It knows nothing about HTTP.
 */
export class DomainRuleError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retryAfterSeconds?: number;

  constructor(options: DomainRuleErrorOptions) {
    const messageKey = options.messageKey ?? `errors.${options.code.toLowerCase()}`;
    super(`${options.code}: ${messageKey}`);
    this.name = "DomainRuleError";
    this.code = options.code;
    this.messageKey = messageKey;
    if (options.details !== undefined) this.details = options.details;
    if (options.retryAfterSeconds !== undefined) this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
