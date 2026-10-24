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

/** Empty template `reportReasons`: filing answers 409 (M.7 decision 1). */
export function reportNotConfigured(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportNotConfigured,
  });
}

export function reportOwnListing(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportOwnListing,
  });
}

export function reportUnknownReason(reasonKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportUnknownReason,
    details: { field: "reasonKey", reasonKey },
  });
}

export function reportDailyLimit(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.RATE_LIMITED,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportDailyLimit,
  });
}

/** Unknown, foreign or already-resolved ids in a resolve, or a lost conditional update (M.7 decision 5). */
export function reportStale(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportStale,
  });
}

/** LISTING_HIDDEN on a listing that is neither APPROVED nor HIDDEN (M.7 decision 5). */
export function reportCannotHide(status: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.reportCannotHide,
    details: { status },
  });
}

/** The second permission of decision 6 is missing; the kernel renders FORBIDDEN without a message key. */
export function moderationForbidden(permissionKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.FORBIDDEN,
    details: { permissionKey },
  });
}

export function blockOwnListing(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.blockOwnListing,
  });
}

export function blockAccountLimit(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: DIRECTORY_API_MESSAGE_KEYS.blockAccountLimit,
  });
}
