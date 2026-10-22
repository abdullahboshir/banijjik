import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  accountCreateRequestSchema,
  accountUpdateRequestSchema,
  manualJournalEntryRequestSchema,
  profitAndLossQuerySchema,
} from "./accounting-schemas.js";
const money = { amount: 100, currency: "BDT" };
const body = () => ({
  businessDate: "2026-10-19",
  memo: "Opening capital",
  lines: [
    { accountId: newId(), debit: money },
    { accountId: newId(), credit: money },
  ],
});
describe("bookkeeping requests", () => {
  it("rejects tenant IDs, bad calendar dates, zero money, two-sided lines and out-of-range line counts", () => {
    const input = body();
    expect(manualJournalEntryRequestSchema.safeParse(input).success).toBe(true);
    expect(
      manualJournalEntryRequestSchema.safeParse({ ...input, organizationId: newId() }).success,
    ).toBe(false);
    expect(
      manualJournalEntryRequestSchema.safeParse({ ...input, businessDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      manualJournalEntryRequestSchema.safeParse({
        ...input,
        lines: [{ accountId: newId(), debit: { ...money, amount: 0 } }, input.lines[1]],
      }).success,
    ).toBe(false);
    expect(
      manualJournalEntryRequestSchema.safeParse({
        ...input,
        lines: [{ accountId: newId(), debit: money, credit: money }, input.lines[1]],
      }).success,
    ).toBe(false);
    expect(
      manualJournalEntryRequestSchema.safeParse({ ...input, lines: [input.lines[0]] }).success,
    ).toBe(false);
    expect(
      manualJournalEntryRequestSchema.safeParse({
        ...input,
        lines: Array.from({ length: 21 }, () => input.lines[0]),
      }).success,
    ).toBe(false);
  });
  it("requires a version, a real change, and rejects account retyping or a reversed period", () => {
    expect(accountUpdateRequestSchema.safeParse({ name: { bn: "নগদ", en: "Cash" } }).success).toBe(
      false,
    );
    expect(accountUpdateRequestSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(accountUpdateRequestSchema.safeParse({ version: 1, status: "ARCHIVED" }).success).toBe(
      true,
    );
    expect(
      accountUpdateRequestSchema.safeParse({ version: 1, accountType: "EXPENSE" }).success,
    ).toBe(false);
    expect(
      accountCreateRequestSchema.safeParse({
        name: { bn: "নগদ", en: "Cash" },
        accountType: "ASSET",
      }).success,
    ).toBe(true);
    expect(
      profitAndLossQuerySchema.safeParse({ from: "2026-10-20", to: "2026-10-01" }).success,
    ).toBe(false);
  });
});
