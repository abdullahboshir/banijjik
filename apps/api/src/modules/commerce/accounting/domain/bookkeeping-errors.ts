import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
function failure(code: (typeof ERROR_CODE)[keyof typeof ERROR_CODE], key: string): DomainRuleError {
  return new DomainRuleError({ code, messageKey: "errors.accounting." + key });
}
export const systemAccountLocked = (): DomainRuleError =>
  failure(ERROR_CODE.SYSTEM_ACCOUNT_LOCKED, "system_account_immutable");
export const accountArchived = (): DomainRuleError =>
  failure(ERROR_CODE.BUSINESS_RULE, "account_archived");
export const entryAlreadyReversed = (): DomainRuleError =>
  failure(ERROR_CODE.CONFLICT, "entry_already_reversed");
export const accountCodeConflict = (): DomainRuleError =>
  failure(ERROR_CODE.CONFLICT, "account_code_conflict");
export const futureBusinessDate = (): DomainRuleError =>
  failure(ERROR_CODE.BUSINESS_RULE, "future_business_date");
