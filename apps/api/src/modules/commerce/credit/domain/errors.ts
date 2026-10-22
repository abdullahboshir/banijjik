import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { CREDIT_API_MESSAGE_KEYS } from "@banijjik/contracts/credit";

export class CreditsInsufficientError extends DomainRuleError {
  constructor(
    readonly balance: number,
    readonly cost: number,
  ) {
    super({
      code: ERROR_CODE.CREDITS_INSUFFICIENT,
      messageKey: "errors.credit_credits_insufficient",
      details: { balance, cost },
    });
  }
}

export class CannotUnlockOwnListingError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.CANNOT_UNLOCK_OWN_LISTING,
      messageKey: "errors.credit_cannot_unlock_own_listing",
    });
  }
}

export class ListingNotApprovedError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.LISTING_NOT_APPROVED,
      messageKey: "errors.credit_listing_not_approved",
    });
  }
}

export class ListingNotFoundError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: CREDIT_API_MESSAGE_KEYS.listingNotFound,
    });
  }
}

export class UnlocksPerDayExceededError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.UNLOCKS_PER_DAY_EXCEEDED,
      messageKey: "errors.credit_unlocks_per_day_exceeded",
    });
  }
}

export class CreditAccountNotFoundError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: CREDIT_API_MESSAGE_KEYS.accountNotFound,
    });
  }
}

export class CreditPackNotFoundError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: CREDIT_API_MESSAGE_KEYS.packNotFound,
    });
  }
}

export class CreditPackCurrencyMismatchError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.VALIDATION_ERROR,
      messageKey: CREDIT_API_MESSAGE_KEYS.packCurrencyMismatch,
      details: { field: "price.currency" },
    });
  }
}

export class CreditAdjustmentWouldGoNegativeError extends DomainRuleError {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super({
      code: ERROR_CODE.CREDITS_INSUFFICIENT,
      messageKey: CREDIT_API_MESSAGE_KEYS.adjustmentWouldGoNegative,
      details: { balance, requested },
    });
  }
}

/** An append-only row with the same natural key already exists (unique index). */
export class CreditEntryAlreadyExistsError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.CONFLICT,
      messageKey: "errors.credit_entry_already_exists",
    });
  }
}

/** Another transaction created the (account, listing) unlock first. */
export class ListingUnlockAlreadyExistsError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.CONFLICT,
      messageKey: "errors.credit_listing_unlock_already_exists",
    });
  }
}

export class CreditReferenceTakenError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.CONFLICT,
      messageKey: CREDIT_API_MESSAGE_KEYS.referenceTaken,
    });
  }
}

export class CreditSelfVerifyForbiddenError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.FORBIDDEN,
      messageKey: CREDIT_API_MESSAGE_KEYS.selfVerifyForbidden,
    });
  }
}

export class CreditPurchaseNotFoundError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: CREDIT_API_MESSAGE_KEYS.purchaseNotFound,
    });
  }
}

export class CreditPurchaseNotPendingError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.INVALID_TRANSITION,
      messageKey: CREDIT_API_MESSAGE_KEYS.purchaseNotPending,
    });
  }
}

export class CreditMaxPendingExceededError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.LIMIT_REACHED,
      messageKey: CREDIT_API_MESSAGE_KEYS.maxPendingExceeded,
    });
  }
}

export class CreditPaymentMethodNotConfiguredError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: CREDIT_API_MESSAGE_KEYS.paymentMethodNotConfigured,
    });
  }
}

export class CreditPackNotActiveError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: CREDIT_API_MESSAGE_KEYS.packNotActive,
    });
  }
}
