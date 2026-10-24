import { POSTING_KEY, SYSTEM_ACCOUNT_CODE, type Money } from "@banijjik/contracts/accounting";
import { describe, expect, it } from "vitest";
import { draftSalesReturn, type SalesReturnPostingSnapshot } from "./sales-return-posting-rules.js";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

function snapshotOf(overrides: Partial<SalesReturnPostingSnapshot>): SalesReturnPostingSnapshot {
  return {
    salesReturnId: "return-1",
    businessDate: "2026-10-25",
    locationId: "location-1",
    lineValue: bdt(1000),
    lineTax: bdt(100),
    deliveryReturned: bdt(0),
    roundingReturned: bdt(0),
    cost: bdt(400),
    ...overrides,
  };
}

function totalsOf(lines: readonly { readonly debit: Money; readonly credit: Money }[]): {
  debit: number;
  credit: number;
} {
  return lines.reduce(
    (sum, line) => ({
      debit: sum.debit + line.debit.amount,
      credit: sum.credit + line.credit.amount,
    }),
    { debit: 0, credit: 0 },
  );
}

describe("sales return posting rules", () => {
  it("posts the value on sales returns, tax and receivable, and the cost on inventory", () => {
    const [value, cogs] = draftSalesReturn(snapshotOf({}));

    expect(value?.postingKey).toBe(POSTING_KEY.sales_return_value);
    expect(value?.lines.map((line) => line.accountCode)).toEqual([
      SYSTEM_ACCOUNT_CODE.SALES_RETURNS,
      SYSTEM_ACCOUNT_CODE.TAX_PAYABLE,
      SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE,
    ]);
    expect(cogs?.postingKey).toBe(POSTING_KEY.sales_return_cogs);
    expect(cogs?.lines.map((line) => line.accountCode)).toEqual([
      SYSTEM_ACCOUNT_CODE.INVENTORY,
      SYSTEM_ACCOUNT_CODE.COGS,
    ]);
  });

  it("debits a positive rounding return and still balances", () => {
    const [value] = draftSalesReturn(snapshotOf({ roundingReturned: bdt(3) }));
    const totals = totalsOf(value?.lines ?? []);
    expect(totals.debit).toBe(totals.credit);
    expect(value?.lines.some((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.ROUNDING)).toBe(
      true,
    );
  });

  it("credits a negative rounding return and still balances", () => {
    const [value] = draftSalesReturn(
      snapshotOf({ roundingReturned: bdt(-2), deliveryReturned: bdt(60) }),
    );
    const totals = totalsOf(value?.lines ?? []);
    expect(totals.debit).toBe(totals.credit);
    const rounding = value?.lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.ROUNDING);
    expect(rounding?.credit.amount).toBe(2);
  });

  it("posts no cost entry when no stock came back", () => {
    const drafts = draftSalesReturn(snapshotOf({ cost: bdt(0) }));
    expect(drafts.map((draft) => draft.postingKey)).toEqual([POSTING_KEY.sales_return_value]);
  });
});
