import type { ManualJournalEntryRequest } from "./accounting-contracts.js";

/** Canonical content shared by the approval UI and API; excludes the one-time token. */
export function manualJournalContent(input: ManualJournalEntryRequest): string {
  return JSON.stringify({
    businessDate: input.businessDate,
    locationId: input.locationId ?? null,
    memo: input.memo.trim(),
    lines: input.lines.map((line) => ({
      accountId: line.accountId,
      debit:
        line.debit === undefined
          ? null
          : { amount: line.debit.amount, currency: line.debit.currency },
      credit:
        line.credit === undefined
          ? null
          : { amount: line.credit.amount, currency: line.credit.currency },
    })),
  });
}
