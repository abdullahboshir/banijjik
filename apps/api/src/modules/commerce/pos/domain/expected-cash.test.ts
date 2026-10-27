import { DomainRuleError } from "@banijjik/contracts";
import { PAYMENT_DIRECTION, PAYMENT_METHOD, type Money } from "@banijjik/contracts/payment";
import { describe, expect, it } from "vitest";
import { expectedCash } from "./expected-cash.js";
import type { SessionMethodTotal } from "./session-payment-totals.js";

const FLOAT: Money = { amount: 5_000, currency: "BDT" };

function row(
  method: SessionMethodTotal["method"],
  direction: SessionMethodTotal["direction"],
  totalMinor: number,
  currency = "BDT",
): SessionMethodTotal {
  return { method, direction, currency, totalMinor, count: 1 };
}

describe("expectedCash", () => {
  it("expected cash subtracts a cash reversal of the session", () => {
    const expected = expectedCash({
      openingFloat: FLOAT,
      methodTotals: [
        row(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.IN, 12_000),
        row(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.REFUND, 2_000),
        row(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.REVERSAL, 1_000),
        row(PAYMENT_METHOD.CARD, PAYMENT_DIRECTION.IN, 9_000),
        row(PAYMENT_METHOD.BKASH, PAYMENT_DIRECTION.IN, 3_000),
        row(PAYMENT_METHOD.NAGAD, PAYMENT_DIRECTION.IN, 1_000),
        row(PAYMENT_METHOD.BANK, PAYMENT_DIRECTION.REFUND, 500),
        row(PAYMENT_METHOD.STORE_CREDIT, PAYMENT_DIRECTION.IN, 700),
      ],
    });

    expect(expected).toEqual({ amount: 14_000, currency: "BDT" });
  });

  it("is the opening float when nothing was sold", () => {
    expect(expectedCash({ openingFloat: FLOAT, methodTotals: [] })).toEqual(FLOAT);
  });

  it("refuses a cash total in another currency instead of adding it", () => {
    const run = () =>
      expectedCash({
        openingFloat: FLOAT,
        methodTotals: [row(PAYMENT_METHOD.CASH, PAYMENT_DIRECTION.IN, 100, "USD")],
      });

    expect(run).toThrow(DomainRuleError);
  });
});
