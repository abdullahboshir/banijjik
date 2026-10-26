import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/**
 * A fact in another currency than the organization's is refused, so a daily total never mixes
 * currencies (plan 3.10 decision 4). The event then goes to the dead-letter list.
 */
export function reportCurrencyMismatch(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "errors.report_currency_mismatch",
  });
}

/** A source fact without the timestamp or link the report needs: a bug in the source reader, never a UTC fallback. */
export function reportSourceMissing(subject: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.report_source_missing",
    details: { subject },
  });
}
