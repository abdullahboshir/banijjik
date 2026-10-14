import { CUSTOM_FIELD_RULE_KEY, DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function keyTaken(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.custom_field_key_taken",
  });
}

export function fieldLimitReached(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.custom_field_limit",
    details: { ruleKey: CUSTOM_FIELD_RULE_KEY.CUSTOM_FIELD_LIMIT },
  });
}

export function requiredFieldHidden(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.custom_field_required",
    details: { ruleKey: CUSTOM_FIELD_RULE_KEY.CUSTOM_FIELD_REQUIRED },
  });
}

/** An existing option key stays forever: values already stored under it must keep their meaning. */
export function optionsLocked(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.custom_field_options_locked",
    details: { ruleKey: CUSTOM_FIELD_RULE_KEY.CUSTOM_FIELD_OPTIONS_LOCKED },
  });
}

export function invalidField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

export function versionConflict(currentVersion: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    details: { currentVersion },
  });
}
