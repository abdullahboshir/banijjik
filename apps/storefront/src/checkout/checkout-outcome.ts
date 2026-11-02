import { ERROR_CODE } from "@banijjik/contracts";
import type { CheckoutResponse } from "@banijjik/contracts/website";
import type { ClientResult } from "../api/client-api";

const HTTP_UNAUTHORIZED = 401;

export const SUBMIT_OUTCOME = {
  PLACED: "PLACED",
  PRICE_CHANGED: "PRICE_CHANGED",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  SESSION_LOST: "SESSION_LOST",
  CAPACITY_UNAVAILABLE: "CAPACITY_UNAVAILABLE",
  FAILED: "FAILED",
} as const;

export type SubmitOutcome = (typeof SUBMIT_OUTCOME)[keyof typeof SUBMIT_OUTCOME];

/** True when the server says the browser has no usable guest session (missing, invalid or expired cookie). */
export function isMissingSession(result: ClientResult<unknown>): boolean {
  if (result.status !== HTTP_UNAUTHORIZED) return false;
  return (
    result.errorCode === ERROR_CODE.UNAUTHENTICATED ||
    result.errorCode === ERROR_CODE.WEBSITE_GUEST_SESSION_EXPIRED
  );
}

/** Classifies the checkout answer by the server's error code, never by message text or a bare status. */
export function submitOutcomeOf(result: ClientResult<CheckoutResponse>): SubmitOutcome {
  if (result.ok && result.data) return SUBMIT_OUTCOME.PLACED;
  if (isMissingSession(result)) return SUBMIT_OUTCOME.SESSION_LOST;
  if (result.errorCode === ERROR_CODE.CHECKOUT_PRICE_CHANGED) return SUBMIT_OUTCOME.PRICE_CHANGED;
  if (result.errorCode === ERROR_CODE.CHECKOUT_QUOTE_EXPIRED) return SUBMIT_OUTCOME.QUOTE_EXPIRED;
  if (result.errorCode === ERROR_CODE.CHECKOUT_CAPACITY_UNAVAILABLE) {
    return SUBMIT_OUTCOME.CAPACITY_UNAVAILABLE;
  }
  return SUBMIT_OUTCOME.FAILED;
}

/** The storefront message key that explains a failed quote. */
export function quoteErrorKeyOf(result: ClientResult<unknown>): string {
  if (result.errorCode === ERROR_CODE.WEBSITE_GUEST_CHECKOUT_DISABLED) {
    return "storefront.cart.guestCheckoutDisabled";
  }
  if (result.errorCode === ERROR_CODE.RATE_LIMITED) return "storefront.error.rateLimited";
  return "storefront.cart.quoteError";
}
