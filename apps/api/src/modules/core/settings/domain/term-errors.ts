import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

export function termNotAvailable(termKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.term_not_available",
    details: { termKey },
  });
}

export function termVersionRequired(currentVersion: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    details: { currentVersion },
  });
}
