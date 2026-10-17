import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidField(path: string, messageKey: string): DomainRuleError {
  return invalidFields([{ path, messageKey }]);
}

/** Several field-level failures at once, in the same shape as the schema errors (14-API.md section 3). */
export function invalidFields(
  fields: readonly { readonly path: string; readonly messageKey: string }[],
): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, details: { fields } });
}

/** No such contact in this organization; a contact of another organization looks the same (ADR-080). */
export function contactNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The transition is not allowed from the current status (an archived contact is read-only). */
export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

/** One party, one contact: the phone (or email) already belongs to an ACTIVE contact (09 section 5.1). */
export function contactDuplicate(existingContactId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.contact_duplicate",
    details: { contactId: existingContactId },
  });
}

/** The caller may not read sensitive values, so they may not set or clear one either (ADR-107). */
export function customFieldSensitiveForbidden(fieldKeys: readonly string[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.FORBIDDEN,
    messageKey: "errors.custom_field_sensitive_forbidden",
    details: { fieldKeys },
  });
}

/** The caller's role does not reach the location (14-API.md section 3). */
export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

/**
 * The unique index refused a second ACTIVE contact with this phone: a concurrent create won the race.
 * The use case turns it into `contactDuplicate` after the aborted transaction, when the winner can be read.
 */
export class ContactPhoneTakenError extends DomainRuleError {
  constructor(readonly phoneE164: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "phoneE164" } });
    this.name = "ContactPhoneTakenError";
  }
}
