import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { DIRECTORY_API_MESSAGE_KEYS } from "@banijjik/contracts/directory";

export function listingNotFound(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.listingNotFound,
  });
}

export function listingConflict(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.listingConflict,
  });
}

export function oneListingPerAccount(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.oneListingPerAccount,
  });
}

export function finalRejection(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.finalRejection,
  });
}

export function photoPolicyNone(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.photoPolicyNone,
    details: { field: "photos" },
  });
}

export function invalidListingTransition(status: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.invalidTransition,
    details: { status },
  });
}

export function underMinAge(fieldKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.underMinAge,
    details: { field: fieldKey },
  });
}

export function phoneMustDiffer(fieldKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.phoneMustDiffer,
    details: { field: fieldKey },
  });
}

export function consentRequired(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.consentRequired,
    details: { field: "consents" },
  });
}

export function filterNotAllowed(fieldKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.filterNotAllowed,
    details: { field: fieldKey },
  });
}

export function invalidField(field: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey,
    details: { field },
  });
}
