import {
  DomainRuleError,
  ERROR_CODE,
  PACKAGE_STATUS,
  PLATFORM_RULE_KEY,
} from "@banijjik/contracts";

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidPackageField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

/** No package with this ID. */
export function packageNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The package key is unique among all packages, archived ones included. */
export class DuplicatePackageKeyError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "packageKey" } });
    this.name = "DuplicatePackageKeyError";
  }
}

/** An archived package is read-only history. */
export function packageArchived(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    messageKey: "errors.package_archived",
    details: { currentStatus: PACKAGE_STATUS.ARCHIVED },
  });
}

/** An open subscription (trialing, active or past due) still uses the package. */
export function packageInUse(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.package_in_use",
    details: { ruleKey: PLATFORM_RULE_KEY.PACKAGE_IN_USE },
  });
}

export interface ClosureGap {
  readonly moduleKey: string;
  readonly missingDependency: string;
}

/** A module of the package needs a module that the package, SYSTEM and CORE do not provide (10 section 3). */
export function packageNotClosed(gaps: readonly ClosureGap[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.package_not_closed",
    details: { ruleKey: PLATFORM_RULE_KEY.PACKAGE_NOT_CLOSED, gaps },
  });
}
