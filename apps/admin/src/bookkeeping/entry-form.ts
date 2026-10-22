import { MANUAL_JOURNAL_MIN_LINES, MANUAL_JOURNAL_MAX_LINES } from "@banijjik/contracts/accounting";
import { moneyFromInput } from "@banijjik/web-client";
import type { AccountResponse, ManualJournalLine } from "@banijjik/contracts/accounting";
export interface EntryLine {
  formLineId?: string;
  accountId: string;
  debit: string;
  credit: string;
}
function parseLine(line: EntryLine): ManualJournalLine | undefined {
  if (line.accountId === "") return undefined;
  const hasDebit = line.debit.trim() !== "";
  const hasCredit = line.credit.trim() !== "";
  if (hasDebit === hasCredit) return undefined;
  const amount = moneyFromInput(hasDebit ? line.debit : line.credit, "BDT");
  if (amount === undefined || amount.amount <= 0) return undefined;
  return hasDebit
    ? { accountId: line.accountId, debit: amount }
    : { accountId: line.accountId, credit: amount };
}
export function entryLines(lines: readonly EntryLine[]): ManualJournalLine[] | undefined {
  const result: ManualJournalLine[] = [];
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed === undefined) return undefined;
    result.push(parsed);
  }
  return result;
}
export function entryTotals(lines: readonly ManualJournalLine[]): {
  debit: number;
  credit: number;
  balanced: boolean;
} {
  const debit = lines.reduce((sum, line) => sum + (line.debit?.amount ?? 0), 0);
  const credit = lines.reduce((sum, line) => sum + (line.credit?.amount ?? 0), 0);
  return {
    debit,
    credit,
    balanced:
      lines.length >= MANUAL_JOURNAL_MIN_LINES &&
      lines.length <= MANUAL_JOURNAL_MAX_LINES &&
      debit > 0 &&
      Number.isSafeInteger(debit) &&
      Number.isSafeInteger(credit) &&
      debit === credit,
  };
}
export function accountTree(
  accounts: readonly AccountResponse[],
): { account: AccountResponse; depth: number }[] {
  const ordered = [...accounts].sort(
    (left, right) =>
      left.accountType.localeCompare(right.accountType) ||
      left.accountCode.localeCompare(right.accountCode),
  );
  const codes = new Set(accounts.map((account) => account.accountCode));
  const roots = ordered.filter(
    (account) => account.parentAccountCode === null || !codes.has(account.parentAccountCode),
  );
  const result: { account: AccountResponse; depth: number }[] = [];
  const visited = new Set<string>();
  function append(account: AccountResponse, depth: number): void {
    if (visited.has(account.accountCode)) return;
    visited.add(account.accountCode);
    result.push({ account, depth });
    for (const child of ordered.filter((row) => row.parentAccountCode === account.accountCode))
      append(child, depth + 1);
  }
  for (const root of roots) append(root, 0);
  for (const account of ordered) append(account, 0);
  return result;
}
