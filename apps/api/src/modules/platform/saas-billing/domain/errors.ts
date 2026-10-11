import { DomainRuleError, ERROR_CODE, PLATFORM_RULE_KEY } from "@banijjik/contracts";

/** The BUNDLE package is not seeded: a business cannot get its trial, so it is not created (decision 5 of the plan). */
export function trialPackageMissing(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.trial_package_missing",
  });
}

/** The organization has no open subscription (or the organization does not exist). */
export function subscriptionNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The trial can be extended only while the subscription is TRIALING. */
export function trialNotActive(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.trial_not_active",
    details: { ruleKey: PLATFORM_RULE_KEY.TRIAL_NOT_ACTIVE },
  });
}

/** The base must be an ACTIVE base package and every add-on an ACTIVE add-on. */
export function packageKindMismatch(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.package_kind_mismatch",
    details: { ruleKey: PLATFORM_RULE_KEY.PACKAGE_KIND_MISMATCH },
  });
}
