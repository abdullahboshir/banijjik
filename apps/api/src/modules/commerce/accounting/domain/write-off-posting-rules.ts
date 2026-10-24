import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import { PAYMENT_REQUEST_TYPE, type PaymentRequestType } from "@banijjik/contracts/payment";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  assertBalanced,
  credit,
  debit,
  type DraftJournalEntry,
  type DraftJournalLine,
} from "./journal-lines.js";
import type { PaymentPostingSnapshot } from "./posting-rules.js";

/**
 * Whether the closure of a request had recognised income, so that a write-off must also post bad
 * debt. A booking recognises its retained fee. An enrollment keeps its money in customer advances
 * until card 3.31, so its reversal already brings advances back to zero. An order closure refunds
 * everything, so a reversal never reaches it.
 */
const CLOSURE_RECOGNISED_INCOME: Readonly<Record<PaymentRequestType, boolean>> = {
  [PAYMENT_REQUEST_TYPE.BOOKING]: true,
  [PAYMENT_REQUEST_TYPE.ENROLLMENT]: false,
  [PAYMENT_REQUEST_TYPE.ORDER]: false,
};

/**
 * Bad debt for the forgiven part of closed requests: Dr BAD_DEBT_EXPENSE, Cr CUSTOMER_ADVANCES.
 * One journal per reversal payment, so a replay of the event posts it once.
 */
export function draftBadDebtWriteOff(
  snapshot: PaymentPostingSnapshot,
): DraftJournalEntry | undefined {
  const rows = (snapshot.writeOffs ?? []).filter(
    (writeOff) => CLOSURE_RECOGNISED_INCOME[writeOff.requestType] && writeOff.amount.amount > 0,
  );
  const first = rows[0];
  if (first === undefined) return undefined;
  // One payment has one currency; a mixed list is a programming error, never summed (§11 item 3).
  if (rows.some((writeOff) => writeOff.amount.currency !== first.amount.currency))
    throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  const total: Money = {
    amount: rows.reduce((sum, writeOff) => sum + writeOff.amount.amount, 0),
    currency: first.amount.currency,
  };
  const lines: readonly DraftJournalLine[] = [
    debit(SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE, total),
    credit(SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, total),
  ];
  assertBalanced(lines);
  return {
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
    sourceId: snapshot.paymentId,
    postingKey: POSTING_KEY.bad_debt_written_off,
    lines,
  };
}
