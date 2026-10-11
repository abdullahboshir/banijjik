import { DomainRuleError, ERROR_CODE, PLATFORM_RULE_KEY } from "@banijjik/contracts";

/** The module has no registered manifest, so there is nothing to grant or revoke yet. */
export function moduleNotRegistered(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.module_not_registered",
    details: { ruleKey: PLATFORM_RULE_KEY.MODULE_NOT_REGISTERED },
  });
}

/** SYSTEM modules are always on and PLATFORM modules never reach an organization. */
export function moduleClassFixed(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.module_class_fixed",
    details: { ruleKey: PLATFORM_RULE_KEY.MODULE_CLASS_FIXED },
  });
}

/** No such organization or override; an override of another organization looks the same (ADR-080). */
export function overrideNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The same module already has an override with this effect for the organization. */
export class DuplicateOverrideError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "moduleKey" } });
    this.name = "DuplicateOverrideError";
  }
}

/** The expiry must lie in the future. */
export function expiryInPast(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "expiresAt", messageKey: "validation.invalid_value" }] },
  });
}
