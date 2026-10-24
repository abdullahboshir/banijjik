import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import {
  assertBalanced,
  credit,
  debit,
  type DraftJournalEntry,
  type DraftJournalLine,
} from "./journal-lines.js";

/** What a return posts, read once from the return row and its stock movements (plan 3.5b decision 9). */
export interface SalesReturnPostingSnapshot {
  readonly salesReturnId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  /** Σ of the line values, tax included. */
  readonly lineValue: Money;
  /** Σ of the tax inside the line values. */
  readonly lineTax: Money;
  readonly deliveryReturned: Money;
  /** Signed: the order's rounding adjustment given back with the return that empties it. */
  readonly roundingReturned: Money;
  /** Cost of the goods that came back to stock, restocked and damaged alike. */
  readonly cost: Money;
}

function entry(
  snapshot: SalesReturnPostingSnapshot,
  postingKey:
    (typeof POSTING_KEY)["sales_return_value"] | (typeof POSTING_KEY)["sales_return_cogs"],
  lines: readonly DraftJournalLine[],
): DraftJournalEntry {
  assertBalanced(lines);
  return {
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.SALES_RETURN,
    sourceId: snapshot.salesReturnId,
    postingKey,
    lines,
  };
}

/**
 * The revenue reversal: the value leaves receivables, the sales returns and tax and delivery income
 * are reversed. A positive rounding is a debit, a negative one a credit, mirroring the order's entry.
 */
function valueLines(snapshot: SalesReturnPostingSnapshot): DraftJournalLine[] {
  const currency = snapshot.lineValue.currency;
  const rounding = snapshot.roundingReturned.amount;
  const netOfTax = snapshot.lineValue.amount - snapshot.lineTax.amount;
  const total = snapshot.lineValue.amount + snapshot.deliveryReturned.amount + rounding;
  const lines: DraftJournalLine[] = [];
  if (netOfTax > 0)
    lines.push(debit(SYSTEM_ACCOUNT_CODE.SALES_RETURNS, { amount: netOfTax, currency }));
  if (snapshot.lineTax.amount > 0)
    lines.push(debit(SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, snapshot.lineTax));
  if (snapshot.deliveryReturned.amount > 0) {
    lines.push(debit(SYSTEM_ACCOUNT_CODE.DELIVERY_INCOME, snapshot.deliveryReturned));
  }
  if (rounding > 0) lines.push(debit(SYSTEM_ACCOUNT_CODE.ROUNDING, snapshot.roundingReturned));
  if (rounding < 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.ROUNDING, { amount: -rounding, currency }));
  }
  if (total > 0)
    lines.push(credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, { amount: total, currency }));
  return lines;
}

/** The cost of goods comes back into inventory (the order's COGS reversed). */
export function draftSalesReturn(snapshot: SalesReturnPostingSnapshot): DraftJournalEntry[] {
  const drafts: DraftJournalEntry[] = [];
  const lines = valueLines(snapshot);
  if (lines.length > 0) {
    drafts.push(entry(snapshot, POSTING_KEY.sales_return_value, lines));
  }
  if (snapshot.cost.amount > 0) {
    drafts.push(
      entry(snapshot, POSTING_KEY.sales_return_cogs, [
        debit(SYSTEM_ACCOUNT_CODE.INVENTORY, snapshot.cost),
        credit(SYSTEM_ACCOUNT_CODE.COGS, snapshot.cost),
      ]),
    );
  }
  return drafts;
}
