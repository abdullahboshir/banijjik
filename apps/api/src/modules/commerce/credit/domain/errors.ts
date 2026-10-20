import { DomainRuleError } from "@banijjik/contracts";

export class CreditsInsufficientError extends DomainRuleError {
  constructor(
    readonly balance: number,
    readonly cost: number,
  ) {
    super("CREDITS_INSUFFICIENT", "errors.credit_credits_insufficient");
  }
}

export class CannotUnlockOwnListingError extends DomainRuleError {
  constructor() {
    super("CANNOT_UNLOCK_OWN_LISTING", "errors.credit_cannot_unlock_own_listing");
  }
}

export class ListingNotApprovedError extends DomainRuleError {
  constructor() {
    super("LISTING_NOT_APPROVED", "errors.credit_listing_not_approved");
  }
}

export class UnlocksPerDayExceededError extends DomainRuleError {
  constructor() {
    super("UNLOCKS_PER_DAY_EXCEEDED", "errors.credit_unlocks_per_day_exceeded");
  }
}
