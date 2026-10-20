import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

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

export class UnlocksPerDayExceededError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.UNLOCKS_PER_DAY_EXCEEDED,
      messageKey: "errors.credit_unlocks_per_day_exceeded",
    });
  }
}
