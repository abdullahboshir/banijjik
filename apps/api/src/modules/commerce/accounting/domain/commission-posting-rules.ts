import {
  JOURNAL_SOURCE_TYPE,
  METHOD_ACCOUNT_CODE,
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

export interface CommissionEntryPostingSnapshot {
  readonly commissionEntryId: string;
  readonly businessDate: string;
  readonly locationId: string;
  /** Signed: an accrual or a restored commission is above 0, a refund adjustment below 0. */
  readonly amount: Money;
  readonly entryKind: "ACCRUAL" | "REFUND_ADJUSTMENT";
}

export interface CommissionPayoutPostingSnapshot {
  readonly commissionPayoutId: string;
  readonly businessDate: string;
  readonly locationId: string;
  readonly total: Money;
  readonly method: "CASH" | "BKASH" | "NAGAD" | "BANK";
}

function entry(
  input: Omit<DraftJournalEntry, "lines"> & { readonly lines: readonly DraftJournalLine[] },
): DraftJournalEntry {
  assertBalanced(input.lines);
  return input;
}

/**
 * Commission is an expense when it accrues, owed to the member until a payout (ADR-135). A negative
 * adjustment (a refund after completion) reverses part of it.
 */
export function draftCommissionEntryRecorded(
  snapshot: CommissionEntryPostingSnapshot,
): DraftJournalEntry {
  const amount: Money = {
    amount: Math.abs(snapshot.amount.amount),
    currency: snapshot.amount.currency,
  };
  const isReduction = snapshot.amount.amount < 0;
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.COMMISSION,
    sourceId: snapshot.commissionEntryId,
    postingKey:
      snapshot.entryKind === "ACCRUAL"
        ? POSTING_KEY.commission_accrued
        : POSTING_KEY.commission_adjusted,
    lines: isReduction
      ? [
          debit(SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, amount),
          credit(SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE, amount),
        ]
      : [
          debit(SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE, amount),
          credit(SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, amount),
        ],
  });
}

/** A payout settles the payable from the account the money left. */
export function draftCommissionPaid(snapshot: CommissionPayoutPostingSnapshot): DraftJournalEntry {
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.COMMISSION,
    sourceId: snapshot.commissionPayoutId,
    postingKey: POSTING_KEY.commission_paid,
    lines: [
      debit(SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, snapshot.total),
      credit(METHOD_ACCOUNT_CODE[snapshot.method], snapshot.total),
    ],
  });
}
