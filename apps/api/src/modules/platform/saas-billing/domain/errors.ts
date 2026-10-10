import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** The BUNDLE package is not seeded: a business cannot get its trial, so it is not created (decision 5 of the plan). */
export function trialPackageMissing(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.trial_package_missing",
  });
}
