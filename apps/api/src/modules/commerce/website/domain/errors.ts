import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

export { DomainRuleError };

export function versionConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.version_conflict" });
}
