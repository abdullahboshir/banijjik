import {
  DomainRuleError,
  ERROR_CODE,
  SETTINGS_RULE_KEY,
  type ModuleKey,
} from "@banijjik/contracts";

export function moduleNotTenantDisablable(moduleKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.module_not_tenant_disablable",
    details: { ruleKey: SETTINGS_RULE_KEY.MODULE_NOT_TENANT_DISABLABLE, moduleKey },
  });
}

export function moduleRequiredBy(
  moduleKey: string,
  requiredBy: readonly ModuleKey[],
): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.module_required_by",
    details: { ruleKey: SETTINGS_RULE_KEY.MODULE_REQUIRED_BY, moduleKey, requiredBy },
  });
}
