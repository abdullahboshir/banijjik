import {
  JOURNAL_SOURCE_TYPE,
  METHOD_ACCOUNT_CODE,
  POSTING_KEY,
  REVENUE_STATE,
  SYSTEM_ACCOUNT_CODE,
  type Money,
  type PostingKey,
} from "@banijjik/contracts/accounting";
import {
  assertBalanced,
  credit,
  debit,
  type DraftJournalEntry,
  type DraftJournalLine,
} from "./journal-lines.js";

export type PaymentMethodCode = keyof typeof METHOD_ACCOUNT_CODE;

export interface PaymentAllocationForPosting {
  readonly requestId: string;
  readonly amount: Money;
  readonly revenueState: (typeof REVENUE_STATE)[keyof typeof REVENUE_STATE];
}

/**
 * What posting needs from a payment (lead clarification). Allocations carry each request's
 * revenue state; the engine splits before/after revenue into separate journal entries.
 */
export interface PaymentPostingSnapshot {
  readonly paymentId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly amount: Money;
  readonly method: PaymentMethodCode;
  readonly direction: "IN" | "REFUND" | "REVERSAL";
  readonly allocations: readonly PaymentAllocationForPosting[];
  /** Part of an IN payment that becomes store credit (overpayment). */
  readonly overpaymentToStoreCredit?: Money | undefined;
  /** Original payment id when direction is REVERSAL. */
  readonly reversesPaymentId?: string | undefined;
}

export interface StoreCreditPostingSnapshot {
  readonly storeCreditEntryId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly amount: Money;
  readonly kind: "EXPIRY";
}

export type BookingRevenueKind = "SERVICE" | "RENTAL" | "EVENT" | "PLAN";

export interface BookingPostingSnapshot {
  readonly bookingId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly kind: BookingRevenueKind;
  readonly revenueExcludingTax: Money;
  readonly tax: Money;
  readonly advancesToSettle: Money;
  readonly cancellationFeeRetained?: Money | undefined;
}

export interface ExpensePostingSnapshot {
  readonly expenseId: string;
  readonly businessDate: string;
  readonly locationId: string;
  readonly amount: Money;
  readonly paidVia: Exclude<PaymentMethodCode, "STORE_CREDIT">;
  readonly categoryAccountCode: string;
  readonly status: "POSTED" | "VOIDED";
}

const REVENUE_ACCOUNT: Readonly<Record<BookingRevenueKind, string>> = {
  SERVICE: SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE,
  RENTAL: SYSTEM_ACCOUNT_CODE.REVENUE_RENTAL,
  EVENT: SYSTEM_ACCOUNT_CODE.REVENUE_EVENT,
  PLAN: SYSTEM_ACCOUNT_CODE.REVENUE_PLAN,
};

function liabilityFor(revenueState: PaymentAllocationForPosting["revenueState"]): string {
  return revenueState === REVENUE_STATE.BEFORE_REVENUE
    ? SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES
    : SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE;
}

function methodCode(method: PaymentMethodCode): string {
  return METHOD_ACCOUNT_CODE[method];
}

function paymentInPostingKey(
  method: PaymentMethodCode,
  revenueState: PaymentAllocationForPosting["revenueState"],
): PostingKey {
  if (method === "STORE_CREDIT") return POSTING_KEY.payment_store_credit;
  if (revenueState === REVENUE_STATE.BEFORE_REVENUE) return POSTING_KEY.payment_in_advance;
  return POSTING_KEY.payment_in_after_revenue;
}

function entry(
  input: Omit<DraftJournalEntry, "lines"> & { readonly lines: readonly DraftJournalLine[] },
): DraftJournalEntry {
  assertBalanced(input.lines);
  return input;
}

function sumByRevenueState(
  allocations: readonly PaymentAllocationForPosting[],
): ReadonlyMap<PaymentAllocationForPosting["revenueState"], Money> {
  const totals = new Map<PaymentAllocationForPosting["revenueState"], Money>();
  for (const allocation of allocations) {
    const previous = totals.get(allocation.revenueState);
    totals.set(allocation.revenueState, {
      amount: (previous?.amount ?? 0) + allocation.amount.amount,
      currency: allocation.amount.currency,
    });
  }
  return totals;
}

/** Payment IN before or after revenue, including store-credit method and overpayment split. */
export function draftPaymentReceived(snapshot: PaymentPostingSnapshot): DraftJournalEntry[] {
  const { method, overpaymentToStoreCredit, paymentId, businessDate, locationId, allocations } =
    snapshot;
  const drafts: DraftJournalEntry[] = [];

  for (const [revenueState, allocated] of sumByRevenueState(allocations)) {
    if (allocated.amount <= 0) continue;
    const postingKey = paymentInPostingKey(method, revenueState);
    const liability = liabilityFor(revenueState);
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
        sourceId: paymentId,
        postingKey,
        lines: [debit(methodCode(method), allocated), credit(liability, allocated)],
      }),
    );
  }

  if (overpaymentToStoreCredit !== undefined && overpaymentToStoreCredit.amount > 0) {
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
        sourceId: paymentId,
        postingKey: POSTING_KEY.overpayment_to_store_credit,
        lines: [
          debit(methodCode(method), overpaymentToStoreCredit),
          credit(SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY, overpaymentToStoreCredit),
        ],
      }),
    );
  }

  return drafts;
}

/** Refund drafts: one entry per revenue-state bucket of the allocations. */
export function draftPaymentRefund(snapshot: PaymentPostingSnapshot): DraftJournalEntry[] {
  const drafts: DraftJournalEntry[] = [];
  for (const [revenueState, amount] of sumByRevenueState(snapshot.allocations)) {
    if (amount.amount <= 0) continue;
    const postingKey =
      revenueState === REVENUE_STATE.BEFORE_REVENUE
        ? POSTING_KEY.refund_advance
        : POSTING_KEY.refund_after_revenue;
    drafts.push(
      entry({
        businessDate: snapshot.businessDate,
        locationId: snapshot.locationId,
        sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
        sourceId: snapshot.paymentId,
        postingKey,
        lines: [
          debit(liabilityFor(revenueState), amount),
          credit(methodCode(snapshot.method), amount),
        ],
      }),
    );
  }
  return drafts;
}

export function draftStoreCreditExpiry(snapshot: StoreCreditPostingSnapshot): DraftJournalEntry {
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.STORE_CREDIT,
    sourceId: snapshot.storeCreditEntryId,
    postingKey: POSTING_KEY.store_credit_expiry,
    lines: [
      debit(SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY, snapshot.amount),
      credit(SYSTEM_ACCOUNT_CODE.OTHER_INCOME, snapshot.amount),
    ],
  });
}

export function draftBookingCompleted(snapshot: BookingPostingSnapshot): DraftJournalEntry[] {
  const { revenueExcludingTax, tax, advancesToSettle, bookingId, businessDate, locationId, kind } =
    snapshot;
  const arTotal = {
    amount: revenueExcludingTax.amount + tax.amount,
    currency: revenueExcludingTax.currency,
  };
  const lines: DraftJournalLine[] = [debit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, arTotal)];
  if (revenueExcludingTax.amount > 0) {
    lines.push(credit(REVENUE_ACCOUNT[kind], revenueExcludingTax));
  }
  if (tax.amount > 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, tax));
  }
  const drafts: DraftJournalEntry[] = [
    entry({
      businessDate,
      locationId,
      sourceType: JOURNAL_SOURCE_TYPE.BOOKING,
      sourceId: bookingId,
      postingKey: POSTING_KEY.booking_completed,
      lines,
    }),
  ];
  if (advancesToSettle.amount > 0) {
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.BOOKING,
        sourceId: bookingId,
        postingKey: POSTING_KEY.booking_completed_settle_advances,
        lines: [
          debit(SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, advancesToSettle),
          credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, advancesToSettle),
        ],
      }),
    );
  }
  return drafts;
}

export function draftCancellationFee(
  snapshot: BookingPostingSnapshot,
): DraftJournalEntry | undefined {
  const fee = snapshot.cancellationFeeRetained;
  if (fee === undefined || fee.amount <= 0) return undefined;
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.BOOKING,
    sourceId: snapshot.bookingId,
    postingKey: POSTING_KEY.cancellation_fee,
    lines: [
      debit(SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, fee),
      credit(SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME, fee),
    ],
  });
}

export function draftExpensePosted(snapshot: ExpensePostingSnapshot): DraftJournalEntry {
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.EXPENSE,
    sourceId: snapshot.expenseId,
    postingKey: POSTING_KEY.expense_posted,
    lines: [
      debit(snapshot.categoryAccountCode, snapshot.amount),
      credit(methodCode(snapshot.paidVia), snapshot.amount),
    ],
  });
}

/** Void posts a mirrored reversing entry keyed as expense_voided. */
export function draftExpenseVoided(
  snapshot: ExpensePostingSnapshot,
  originalLines: readonly { accountCode: string; debit: Money; credit: Money }[],
  reversesJournalEntryId: string,
): DraftJournalEntry {
  return entry({
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.EXPENSE,
    sourceId: snapshot.expenseId,
    postingKey: POSTING_KEY.expense_voided,
    reversesJournalEntryId,
    lines: originalLines.map((line) => ({
      accountCode: line.accountCode,
      debit: line.credit,
      credit: line.debit,
    })),
  });
}
