import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

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
