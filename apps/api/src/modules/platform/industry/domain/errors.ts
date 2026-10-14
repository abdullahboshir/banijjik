import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** A field of an industry template failed its format or catalogue check. */
export function invalidIndustryTemplateField(path: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey: "validation.invalid_value" }] },
  });
}

/** No template with this id. */
export function industryTemplateNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}
