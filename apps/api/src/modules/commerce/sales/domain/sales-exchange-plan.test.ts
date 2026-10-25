import { DomainRuleError, type CurrencyCode } from "@banijjik/contracts";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { planSalesExchange } from "./sales-exchange-plan.js";

/** The rule key a refused plan carries in its details (the message key alone does not name it). */
function ruleKeyOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error instanceof DomainRuleError ? error.details?.["ruleKey"] : undefined;
  }
  return undefined;
}

const BDT: CurrencyCode = "BDT";
// Only BDT is a CurrencyCode today; a second code is widened on purpose to test the mismatch rule.
const OTHER_CURRENCY: string = "USD";
const USD = OTHER_CURRENCY as CurrencyCode;

function bdt(amount: number) {
  return { amount, currency: BDT };
}

describe("sales exchange money plan", () => {
  it("plans an exchange: the return credit pays the new order first and the rest is paid or left as due", () => {
    const cheaper = planSalesExchange({
      returnCredit: bdt(800),
      newOrderTotal: bdt(500),
      payments: [],
    });
    expect(cheaper.storeCreditUsed).toEqual(bdt(500));
    expect(cheaper.storeCreditLeft).toEqual(bdt(300));
    expect(cheaper.dueAmount).toEqual(bdt(0));

    const equal = planSalesExchange({
      returnCredit: bdt(500),
      newOrderTotal: bdt(500),
      payments: [],
    });
    expect(equal.storeCreditLeft).toEqual(bdt(0));
    expect(equal.dueAmount).toEqual(bdt(0));

    const dearerPaid = planSalesExchange({
      returnCredit: bdt(300),
      newOrderTotal: bdt(1000),
      payments: [bdt(700)],
    });
    expect(dearerPaid.storeCreditUsed).toEqual(bdt(300));
    expect(dearerPaid.dueAmount).toEqual(bdt(0));

    const dearerDue = planSalesExchange({
      returnCredit: bdt(300),
      newOrderTotal: bdt(1000),
      payments: [],
    });
    expect(dearerDue.dueAmount).toEqual(bdt(700));
  });

  it("refuses payments above what is left to pay and payments in another currency", () => {
    expect(
      ruleKeyOf(() =>
        planSalesExchange({
          returnCredit: bdt(300),
          newOrderTotal: bdt(1000),
          payments: [bdt(701)],
        }),
      ),
    ).toBe(SALES_RULE_KEY.SALES_EXCHANGE_PAYMENTS_ABOVE_TOTAL);
    expect(
      ruleKeyOf(() =>
        planSalesExchange({
          returnCredit: bdt(0),
          newOrderTotal: bdt(1000),
          payments: [{ amount: 10, currency: USD }],
        }),
      ),
    ).toBe(SALES_RULE_KEY.SALES_EXCHANGE_CURRENCY_MISMATCH);
    expect(
      ruleKeyOf(() =>
        planSalesExchange({
          returnCredit: { amount: 10, currency: USD },
          newOrderTotal: bdt(1000),
          payments: [],
        }),
      ),
    ).toBe(SALES_RULE_KEY.SALES_EXCHANGE_CURRENCY_MISMATCH);
  });

  it("an unpaid original order gives no credit, so the new order is paid by the payments or left as due", () => {
    const plan = planSalesExchange({
      returnCredit: bdt(0),
      newOrderTotal: bdt(1000),
      payments: [bdt(400)],
    });
    expect(plan.storeCreditUsed).toEqual(bdt(0));
    expect(plan.storeCreditLeft).toEqual(bdt(0));
    expect(plan.dueAmount).toEqual(bdt(600));
  });
});
