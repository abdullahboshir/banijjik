import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { COMMISSION_API_MESSAGE_KEYS } from "@banijjik/contracts/commission";

export { DomainRuleError };

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

export function versionConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.version_conflict" });
}

/** `existingCommissionRuleId` is absent when a parallel create won the race and the winner is not readable yet. */
export function ruleDuplicate(existingCommissionRuleId?: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: COMMISSION_API_MESSAGE_KEYS.ruleDuplicate,
    ...(existingCommissionRuleId === undefined
      ? {}
      : { details: { commissionRuleId: existingCommissionRuleId } }),
  });
}

export function currencyMismatch(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: COMMISSION_API_MESSAGE_KEYS.currencyMismatch,
  });
}

export function kindNotEnabled(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: COMMISSION_API_MESSAGE_KEYS.kindNotEnabled,
  });
}

/** A rule that is already archived cannot be edited or archived again. */
export function ruleArchived(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION });
}
