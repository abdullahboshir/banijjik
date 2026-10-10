import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

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
