import { ERROR_CODE, type ErrorCode } from "@banijjik/contracts";

export interface DomainRuleErrorOptions {
  readonly code: ErrorCode;
  readonly messageKey?: string;
  readonly details?: { readonly [key: string]: unknown };
  readonly retryAfterSeconds?: number;
}

/**
 * A business rule of the iam module that failed. It carries a contracts error code and a message
 * key and nothing about HTTP: presentation maps it to the API error (the domain imports no kernel).
 */
export class DomainRuleError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly details?: { readonly [key: string]: unknown };
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

/** The same answer for an unknown identifier and a wrong password, so login reveals neither. */
export function invalidCredentials(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.UNAUTHENTICATED,
    messageKey: "errors.invalid_credentials",
  });
}

/** A missing, unknown, expired, revoked or reused session or token. */
export function sessionNotValid(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.UNAUTHENTICATED });
}

export function accountLocked(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.account_locked" });
}

export function accountDisabled(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.account_disabled" });
}

export function tooManyAttempts(retryAfterSeconds: number): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.RATE_LIMITED, retryAfterSeconds });
}

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

export type IdentifierField = "email" | "phone";

/** The email or phone number already belongs to an account. */
export class DuplicateIdentifierError extends DomainRuleError {
  constructor(readonly field: IdentifierField) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field } });
    this.name = "DuplicateIdentifierError";
  }
}

/**
 * A refresh that lost a race with another request using the same token (two tabs). It is a 401
 * like any other, but the browser must keep its cookies: the winner just set new ones.
 */
export class RefreshRaceError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.UNAUTHENTICATED });
    this.name = "RefreshRaceError";
  }
}
