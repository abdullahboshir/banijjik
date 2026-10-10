import { ERROR_CODE, type ErrorCode } from "@banijjik/contracts";

export interface DomainRuleErrorOptions {
  readonly code: ErrorCode;
  readonly messageKey?: string;
  readonly details?: { readonly [key: string]: unknown };
}

/**
 * A business rule of the organization module that failed. It carries a contracts error code and
 * a message key and nothing about HTTP: presentation maps it to the API error (the domain
 * imports no kernel).
 */
export class DomainRuleError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly details?: { readonly [key: string]: unknown };

  constructor(options: DomainRuleErrorOptions) {
    const messageKey = options.messageKey ?? `errors.${options.code.toLowerCase()}`;
    super(`${options.code}: ${messageKey}`);
    this.name = "DomainRuleError";
    this.code = options.code;
    this.messageKey = messageKey;
    if (options.details !== undefined) this.details = options.details;
  }
}

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

/** The slug already belongs to an organization, or was taken a moment ago by a concurrent request. */
export class SlugTakenError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "slug" } });
    this.name = "SlugTakenError";
  }
}

/** The caller has no usable account any more, e.g. a valid token for a deleted user. */
export function sessionNotValid(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.UNAUTHENTICATED });
}
