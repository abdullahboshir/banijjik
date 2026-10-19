import type { Money, PostingKey } from "@banijjik/contracts/accounting";
import { unbalancedJournal } from "./errors.js";

/** A journal line before account ids are resolved: one side only (debit or credit). */
export interface DraftJournalLine {
  readonly accountCode: string;
  readonly debit: Money;
  readonly credit: Money;
}

export interface ResolvedJournalLine {
  readonly accountId: string;
  readonly accountCode: string;
  readonly debit: Money;
  readonly credit: Money;
}

export interface DraftJournalEntry {
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly postingKey: PostingKey;
  readonly lines: readonly DraftJournalLine[];
  readonly reversesJournalEntryId?: string | undefined;
}

function zeroMoney(currency: string): Money {
  return { amount: 0, currency: currency as Money["currency"] };
}

/** Debit line: credit side is zero. */
export function debit(accountCode: string, amount: Money): DraftJournalLine {
  return { accountCode, debit: amount, credit: zeroMoney(amount.currency) };
}

/** Credit line: debit side is zero. */
export function credit(accountCode: string, amount: Money): DraftJournalLine {
  return { accountCode, debit: zeroMoney(amount.currency), credit: amount };
}

export function sumSide(lines: readonly DraftJournalLine[], side: "debit" | "credit"): number {
  return lines.reduce((total, line) => total + line[side].amount, 0);
}

/** Throws when Σ debit ≠ Σ credit. Never skip an unbalanced posting (11 §10). */
export function assertBalanced(lines: readonly DraftJournalLine[]): void {
  const debitTotal = sumSide(lines, "debit");
  const creditTotal = sumSide(lines, "credit");
  if (debitTotal !== creditTotal) throw unbalancedJournal(debitTotal, creditTotal);
}

/** Mirror for a reversing entry: each debit becomes a credit and vice versa. */
export function mirrorLines(lines: readonly ResolvedJournalLine[]): DraftJournalLine[] {
  return lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.credit,
    credit: line.debit,
  }));
}
