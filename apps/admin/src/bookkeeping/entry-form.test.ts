import { describe, expect, it } from "vitest";
import { entryLines, entryTotals, accountTree } from "./entry-form";
import type { AccountResponse } from "@banijjik/contracts/accounting";
const money = (amount: number) => ({ amount, currency: "BDT" as const });
describe("manual entry balance", () => {
  it("converts decimal input to integer minor units and rejects unequal totals", () => {
    const lines = entryLines([
      { accountId: "cash", debit: "125.50", credit: "" },
      { accountId: "capital", debit: "", credit: "125.50" },
    ]);
    expect(lines).toEqual([
      { accountId: "cash", debit: money(12550) },
      { accountId: "capital", credit: money(12550) },
    ]);
    expect(entryTotals(lines ?? []).balanced).toBe(true);
    expect(
      entryTotals([
        { accountId: "a", debit: money(500) },
        { accountId: "b", credit: money(499) },
      ]).balanced,
    ).toBe(false);
  });
  it("rejects zero, negative, malformed, blank-account and two-sided input", () => {
    for (const debit of ["0", "-1", "abc"])
      expect(entryLines([{ accountId: "a", debit, credit: "" }])).toBeUndefined();
    expect(entryLines([{ accountId: "", debit: "1", credit: "" }])).toBeUndefined();
    expect(entryLines([{ accountId: "a", debit: "1", credit: "1" }])).toBeUndefined();
    expect(entryTotals([]).balanced).toBe(false);
  });
});
describe("account tree", () => {
  it("keeps same-type children adjacent to parents and terminates malformed cycles", () => {
    const account = (code: string, parent: string | null): AccountResponse => ({
      accountId: code,
      accountCode: code,
      parentAccountCode: parent,
      name: { bn: code, en: code },
      accountType: "ASSET",
      isSystem: false,
      status: "ACTIVE",
      version: 1,
    });
    const rows = accountTree([
      account("BANK", null),
      account("C-1", "BANK"),
      account("C-2", "C-1"),
    ]);
    expect(rows.map((row) => [row.account.accountCode, row.depth])).toEqual([
      ["BANK", 0],
      ["C-1", 1],
      ["C-2", 2],
    ]);
    expect(accountTree([account("A", "B"), account("B", "A")])).toHaveLength(2);
  });
});
