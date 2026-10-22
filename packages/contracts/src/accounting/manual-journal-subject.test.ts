import { describe, expect, it } from "vitest";
import { manualJournalContent } from "./manual-journal-subject.js";
import type { ManualJournalEntryRequest } from "./accounting-contracts.js";
const request: ManualJournalEntryRequest = {
  businessDate: "2026-10-19",
  locationId: "location",
  memo: " Opening ",
  lines: [
    { accountId: "cash", debit: { amount: 100, currency: "BDT" } },
    { accountId: "capital", credit: { amount: 100, currency: "BDT" } },
  ],
};
describe("manual journal approval content", () => {
  it("normalizes money property order and surrounding memo space", () => {
    expect(manualJournalContent(request)).toBe(
      manualJournalContent({
        ...request,
        memo: "Opening",
        lines: [
          { accountId: "cash", debit: { currency: "BDT", amount: 100 } },
          { accountId: "capital", credit: { currency: "BDT", amount: 100 } },
        ],
      }),
    );
  });
  it("changes when a line, amount, date, memo or location changes", () => {
    const original = manualJournalContent(request);
    for (const changed of [
      { ...request, businessDate: "2026-10-20" },
      { ...request, memo: "Different" },
      { ...request, locationId: "elsewhere" },
      {
        ...request,
        lines: [
          { accountId: "other", debit: { amount: 100, currency: "BDT" as const } },
          { accountId: "capital", credit: { amount: 100, currency: "BDT" as const } },
        ],
      },
      {
        ...request,
        lines: [
          { accountId: "cash", debit: { amount: 200, currency: "BDT" as const } },
          { accountId: "capital", credit: { amount: 100, currency: "BDT" as const } },
        ],
      },
    ])
      expect(manualJournalContent(changed)).not.toBe(original);
  });
});
