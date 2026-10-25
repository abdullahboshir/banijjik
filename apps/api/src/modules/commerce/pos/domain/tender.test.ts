import { DomainRuleError } from "@banijjik/contracts";
import { PAYMENT_METHOD, type Money } from "@banijjik/contracts/payment";
import { POS_RULE_KEY } from "@banijjik/contracts/pos";
import { describe, expect, it } from "vitest";
import { planTender, type TenderInput } from "./tender.js";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

function tenderOf(overrides: Partial<TenderInput>): TenderInput {
  return {
    grandTotal: bdt(1_000),
    storeCreditUse: undefined,
    payments: [],
    cashTendered: undefined,
    allowCreditSale: false,
    hasContact: false,
    ...overrides,
  };
}

function ruleKeyOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainRuleError) return error.details?.["ruleKey"];
    throw error;
  }
  return undefined;
}

describe("planTender", () => {
  it("change is tendered minus the cash part", () => {
    const plan = planTender(
      tenderOf({
        payments: [
          { method: PAYMENT_METHOD.CARD, amount: bdt(400) },
          { method: PAYMENT_METHOD.CASH, amount: bdt(600) },
        ],
        cashTendered: bdt(1_000),
      }),
    );

    expect(plan).toMatchObject({ changeMinor: 400, dueMinor: 0, storeCreditMinor: 0 });
  });

  it("gives no change when no cash was handed over beyond the bill", () => {
    const plan = planTender(
      tenderOf({ payments: [{ method: PAYMENT_METHOD.CASH, amount: bdt(1_000) }] }),
    );

    expect(plan.changeMinor).toBe(0);
  });

  it("a non-cash overpayment is refused", () => {
    const run = () =>
      planTender(tenderOf({ payments: [{ method: PAYMENT_METHOD.CARD, amount: bdt(1_200) }] }));

    expect(ruleKeyOf(run)).toBe(POS_RULE_KEY.OVERPAYMENT_NOT_CASH);
  });

  it("refuses a cash tender below the cash part or without a cash payment", () => {
    const below = () =>
      planTender(
        tenderOf({
          payments: [{ method: PAYMENT_METHOD.CASH, amount: bdt(1_000) }],
          cashTendered: bdt(900),
        }),
      );
    const noCash = () =>
      planTender(
        tenderOf({
          payments: [{ method: PAYMENT_METHOD.CARD, amount: bdt(1_000) }],
          cashTendered: bdt(1_000),
        }),
      );

    expect([ruleKeyOf(below), ruleKeyOf(noCash)]).toEqual([
      POS_RULE_KEY.CASH_TENDERED_INVALID,
      POS_RULE_KEY.CASH_TENDERED_INVALID,
    ]);
  });

  it("counts store credit toward the bill", () => {
    const plan = planTender(
      tenderOf({
        storeCreditUse: bdt(300),
        payments: [{ method: PAYMENT_METHOD.CASH, amount: bdt(700) }],
      }),
    );

    expect(plan).toMatchObject({ storeCreditMinor: 300, dueMinor: 0 });
  });

  it("leaves a due only when credit sale is on and a contact is attached", () => {
    const part = { payments: [{ method: PAYMENT_METHOD.CASH, amount: bdt(400) }] };

    const plan = planTender(tenderOf({ ...part, allowCreditSale: true, hasContact: true }));
    const withoutContact = () => planTender(tenderOf({ ...part, allowCreditSale: true }));
    const switchedOff = () => planTender(tenderOf({ ...part, hasContact: true }));

    expect(plan.dueMinor).toBe(600);
    expect([ruleKeyOf(withoutContact), ruleKeyOf(switchedOff)]).toEqual([
      POS_RULE_KEY.PAYMENT_SHORT,
      POS_RULE_KEY.PAYMENT_SHORT,
    ]);
  });

  it("asks for a tender on a sale with a price and accepts none on a free one", () => {
    const priced = () => planTender(tenderOf({}));
    const free = planTender(tenderOf({ grandTotal: bdt(0) }));

    expect(ruleKeyOf(priced)).toBe(POS_RULE_KEY.TENDER_REQUIRED);
    expect(free).toMatchObject({ dueMinor: 0, changeMinor: 0 });
  });

  it("refuses an amount in another currency", () => {
    const run = () =>
      planTender(
        tenderOf({
          payments: [
            {
              method: PAYMENT_METHOD.CASH,
              amount: { amount: 1_000, currency: "XXX" as Money["currency"] },
            },
          ],
        }),
      );

    expect(ruleKeyOf(run)).toBe(POS_RULE_KEY.CURRENCY_MISMATCH);
  });
});
