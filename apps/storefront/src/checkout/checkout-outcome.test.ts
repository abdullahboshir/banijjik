import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import type { CheckoutResponse } from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import type { ClientResult } from "../api/client-api";
import { quoteErrorKeyOf, SUBMIT_OUTCOME, submitOutcomeOf } from "./checkout-outcome";

function failure(
  status: number,
  errorCode?: string,
  ruleKey?: string,
): ClientResult<CheckoutResponse> {
  return { ok: false, status, data: undefined, fields: [], errorCode, ruleKey };
}

describe("submitOutcomeOf", () => {
  it("maps each checkout answer to its outcome", () => {
    const placed: ClientResult<CheckoutResponse> = {
      ok: true,
      status: 201,
      data: { checkoutId: "checkout-1" } as CheckoutResponse,
      fields: [],
    };

    expect(submitOutcomeOf(placed)).toBe(SUBMIT_OUTCOME.PLACED);
    expect(submitOutcomeOf(failure(409, "CHECKOUT_PRICE_CHANGED"))).toBe(
      SUBMIT_OUTCOME.PRICE_CHANGED,
    );
    expect(submitOutcomeOf(failure(400, "CHECKOUT_QUOTE_EXPIRED"))).toBe(
      SUBMIT_OUTCOME.QUOTE_EXPIRED,
    );
    expect(submitOutcomeOf(failure(401, "UNAUTHENTICATED"))).toBe(SUBMIT_OUTCOME.SESSION_LOST);
    expect(submitOutcomeOf(failure(401, "WEBSITE_GUEST_SESSION_EXPIRED"))).toBe(
      SUBMIT_OUTCOME.SESSION_LOST,
    );
    expect(submitOutcomeOf(failure(500, "INTERNAL_ERROR"))).toBe(SUBMIT_OUTCOME.FAILED);
  });

  it("does not treat a 409 CHECKOUT_CAPACITY_UNAVAILABLE as a price change", () => {
    const outcome = submitOutcomeOf(failure(409, "CHECKOUT_CAPACITY_UNAVAILABLE"));

    expect(outcome).toBe(SUBMIT_OUTCOME.CAPACITY_UNAVAILABLE);
  });

  it("maps a 401 without a session code to FAILED", () => {
    expect(submitOutcomeOf(failure(401))).toBe(SUBMIT_OUTCOME.FAILED);
  });
});

describe("quoteErrorKeyOf", () => {
  it("maps zone unavailable rule key to storefront.cart.deliveryZoneUnavailable", () => {
    expect(
      quoteErrorKeyOf(
        failure(422, "BUSINESS_RULE", SALES_RULE_KEY.DELIVERY_ZONE_UNAVAILABLE),
      ),
    ).toBe("storefront.cart.deliveryZoneUnavailable");
  });

  it("maps other business rule errors to the generic quote error", () => {
    expect(
      quoteErrorKeyOf(
        failure(422, "BUSINESS_RULE", SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED),
      ),
    ).toBe("storefront.cart.quoteError");
  });

  it("maps guest-checkout-off and rate-limit codes to their own keys", () => {
    expect(quoteErrorKeyOf(failure(403, "WEBSITE_GUEST_CHECKOUT_DISABLED"))).toBe(
      "storefront.cart.guestCheckoutDisabled",
    );
    expect(quoteErrorKeyOf(failure(429, "RATE_LIMITED"))).toBe("storefront.error.rateLimited");
  });

  it("maps every other answer to the generic quote error", () => {
    expect(quoteErrorKeyOf(failure(500, "INTERNAL_ERROR"))).toBe("storefront.cart.quoteError");
    expect(quoteErrorKeyOf(failure(401))).toBe("storefront.cart.quoteError");
  });
});
