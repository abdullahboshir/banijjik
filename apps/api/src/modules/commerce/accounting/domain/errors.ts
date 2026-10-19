import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { ACCOUNTING_RULE_KEY } from "@banijjik/contracts/accounting";

export { DomainRuleError };

export function unbalancedJournal(debitTotal: number, creditTotal: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: `errors.accounting.${ACCOUNTING_RULE_KEY.unbalanced_journal}`,
    details: { ruleKey: ACCOUNTING_RULE_KEY.unbalanced_journal, debitTotal, creditTotal },
  });
}

export function accountNotFound(accountCode: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: `errors.accounting.${ACCOUNTING_RULE_KEY.account_not_found}`,
    details: { ruleKey: ACCOUNTING_RULE_KEY.account_not_found, accountCode },
  });
}

export function postingSourceMissing(source: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: `errors.accounting.${ACCOUNTING_RULE_KEY.posting_source_missing}`,
    details: { ruleKey: ACCOUNTING_RULE_KEY.posting_source_missing, source },
  });
}

export function systemAccountImmutable(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: `errors.accounting.${ACCOUNTING_RULE_KEY.system_account_immutable}`,
    details: { ruleKey: ACCOUNTING_RULE_KEY.system_account_immutable },
  });
}
