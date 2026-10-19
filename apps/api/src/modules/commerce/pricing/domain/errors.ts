import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { PRICING_RULE_KEY } from "@banijjik/contracts/pricing";

export { DomainRuleError };

export interface FieldProblem {
  readonly path: string;
  readonly messageKey: string;
}

export function invalidFields(fields: readonly FieldProblem[]): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, details: { fields } });
}

export function invalidField(path: string, messageKey: string): DomainRuleError {
  return invalidFields([{ path, messageKey }]);
}

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

export function taxClassUnknown(details: {
  readonly offeringId?: string;
  readonly taxClassKey: string;
}): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.tax_class_unknown",
    details: { ruleKey: PRICING_RULE_KEY.TAX_CLASS_UNKNOWN, ...details },
  });
}

export function offeringNotAvailable(offeringId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.offering_not_available",
    details: { ruleKey: PRICING_RULE_KEY.OFFERING_NOT_AVAILABLE, offeringId },
  });
}

export function taxClassKeyTaken(taxClassKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.tax_class_key_taken",
    details: { ruleKey: PRICING_RULE_KEY.TAX_CLASS_KEY_TAKEN, taxClassKey },
  });
}

export class TaxClassKeyTakenError extends DomainRuleError {
  constructor(readonly taxClassKey: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "taxClassKey" } });
    this.name = "TaxClassKeyTakenError";
  }
}

export function currencyMismatch(path: string): DomainRuleError {
  return invalidField(path, "errors.promotion_currency_mismatch");
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}
