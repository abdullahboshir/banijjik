import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidPackageField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}
