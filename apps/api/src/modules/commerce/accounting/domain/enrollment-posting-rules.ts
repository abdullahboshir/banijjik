import {
  JOURNAL_SOURCE_TYPE,
  type PostingKey,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  assertBalanced,
  credit,
  debit,
  type DraftJournalEntry,
  type DraftJournalLine,
} from "./journal-lines.js";

/** A period's fee, its held advance and the day the revenue is recognised (card 3.31). */
export interface EnrollmentPeriodRecognitionSnapshot {
  readonly enrollmentPeriodId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly fee: Money;
  /** Net BEFORE_REVENUE money the period's payments hold at posting time. */
  readonly heldAdvance: Money;
}

/** A cancelled period: what the business kept, and whether revenue was already recognised. */
export interface EnrollmentPeriodClosureSnapshot extends EnrollmentPeriodRecognitionSnapshot {
  readonly keptAmount: Money;
  readonly recognizedAmount: Money;
  readonly recognizedBeforeCancel: boolean;
}

function entry(
  snapshot: EnrollmentPeriodRecognitionSnapshot,
  postingKey: PostingKey,
  lines: readonly DraftJournalLine[],
): DraftJournalEntry {
  assertBalanced(lines);
  return {
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.ENROLLMENT,
    sourceId: snapshot.enrollmentPeriodId,
    postingKey,
    lines,
  };
}

/** One currency per period: a mismatch is a programming error, never converted (§11 item 3). */
function assertSameCurrency(fee: Money, other: Money): void {
  if (fee.currency !== other.currency) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
}

/** The advance settle moves only the held advance; never the fee and never the net paid (3.24 R1). */
function settleDraft(snapshot: EnrollmentPeriodRecognitionSnapshot): DraftJournalEntry[] {
  if (snapshot.heldAdvance.amount <= 0) return [];
  return [
    entry(snapshot, POSTING_KEY.enrollment_period_advance_settle, [
      debit(SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, snapshot.heldAdvance),
      credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, snapshot.heldAdvance),
    ]),
  ];
}

/** Plan revenue for a period once it is in service, then settle the advances paid for it. */
export function draftPeriodRevenueRecognized(
  snapshot: EnrollmentPeriodRecognitionSnapshot,
): DraftJournalEntry[] {
  assertSameCurrency(snapshot.fee, snapshot.heldAdvance);
  if (snapshot.fee.amount <= 0) return [];
  const revenue = entry(snapshot, POSTING_KEY.enrollment_period_revenue, [
    debit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, snapshot.fee),
    credit(SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, snapshot.fee),
  ]);
  return [revenue, ...settleDraft(snapshot)];
}

/** Revenue reversal for the part a cancelled, recognised period does not keep (R3). */
function reversalDraft(snapshot: EnrollmentPeriodClosureSnapshot): DraftJournalEntry[] {
  const unkept = snapshot.recognizedAmount.amount - snapshot.keptAmount.amount;
  if (unkept <= 0) return [];
  const amount = { amount: unkept, currency: snapshot.fee.currency };
  return [
    entry(snapshot, POSTING_KEY.enrollment_period_revenue_cancel, [
      debit(SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, amount),
      credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, amount),
    ]),
  ];
}

/** Money kept for a period that never started is a cancellation fee, as for bookings (R4). */
function cancellationFeeDraft(snapshot: EnrollmentPeriodClosureSnapshot): DraftJournalEntry[] {
  if (snapshot.keptAmount.amount <= 0) return [];
  return [
    entry(snapshot, POSTING_KEY.enrollment_period_cancellation_fee, [
      debit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, snapshot.keptAmount),
      credit(SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME, snapshot.keptAmount),
    ]),
  ];
}

/**
 * Closes a cancelled period at what the business kept. The branch comes only from
 * `recognizedBeforeCancel` (amendment 1): kept can equal the fee, so amounts never decide it.
 */
export function draftPeriodClosed(snapshot: EnrollmentPeriodClosureSnapshot): DraftJournalEntry[] {
  assertSameCurrency(snapshot.fee, snapshot.keptAmount);
  assertSameCurrency(snapshot.fee, snapshot.heldAdvance);
  const closing = snapshot.recognizedBeforeCancel
    ? reversalDraft(snapshot)
    : cancellationFeeDraft(snapshot);
  return [...closing, ...settleDraft(snapshot)];
}
