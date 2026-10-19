import { POSTING_KEY, REVENUE_STATE, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { describe, expect, it } from "vitest";
import { assertBalanced, sumSide } from "./journal-lines.js";
import {
  draftBookingCompleted,
  draftCancellationFee,
  draftExpensePosted,
  draftExpenseVoided,
  draftPaymentReceived,
  draftPaymentRefund,
  draftStoreCreditExpiry,
  type BookingPostingSnapshot,
  type ExpensePostingSnapshot,
} from "./posting-rules.js";
import { unbalancedJournal } from "./errors.js";

const money = (amount: number) => ({ amount, currency: "BDT" as const });

function codesOf(
  lines: readonly { accountCode: string; debit: { amount: number }; credit: { amount: number } }[],
) {
  return lines.map((line) => ({
    code: line.accountCode,
    debit: line.debit.amount,
    credit: line.credit.amount,
  }));
}

function requireDraft<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  if (value === undefined) throw new Error("expected draft");
  return value;
}

describe("posting rules matrix (11 §10, card 3.8c)", () => {
  it("posts payment IN before revenue to method / CUSTOMER_ADVANCES", () => {
    const drafts = draftPaymentReceived({
      paymentId: "p1",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(1000),
      method: "CASH",
      direction: "IN",
      allocations: [
        { requestId: "r1", amount: money(1000), revenueState: REVENUE_STATE.BEFORE_REVENUE },
      ],
    });
    const advance = requireDraft(drafts[0]);
    expect(advance.postingKey).toBe(POSTING_KEY.payment_in_advance);
    expect(codesOf(advance.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CASH, debit: 1000, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 0, credit: 1000 },
    ]);
  });

  it("posts payment IN after revenue to method / ACCOUNTS_RECEIVABLE", () => {
    const drafts = draftPaymentReceived({
      paymentId: "p2",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(500),
      method: "BKASH",
      direction: "IN",
      allocations: [
        { requestId: "r1", amount: money(500), revenueState: REVENUE_STATE.AFTER_REVENUE },
      ],
    });
    const afterRevenue = requireDraft(drafts[0]);
    expect(afterRevenue.postingKey).toBe(POSTING_KEY.payment_in_after_revenue);
    expect(codesOf(afterRevenue.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.BKASH, debit: 500, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 500 },
    ]);
  });

  it("posts STORE_CREDIT method payment against AR or advances", () => {
    const drafts = draftPaymentReceived({
      paymentId: "p3",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(200),
      method: "STORE_CREDIT",
      direction: "IN",
      allocations: [
        { requestId: "r1", amount: money(200), revenueState: REVENUE_STATE.AFTER_REVENUE },
      ],
    });
    const storeCredit = requireDraft(drafts[0]);
    expect(storeCredit.postingKey).toBe(POSTING_KEY.payment_store_credit);
    expect(codesOf(storeCredit.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY, debit: 200, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 200 },
    ]);
  });

  it("splits overpayment to store credit", () => {
    const drafts = draftPaymentReceived({
      paymentId: "p4",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(1200),
      method: "CASH",
      direction: "IN",
      allocations: [
        { requestId: "r1", amount: money(1000), revenueState: REVENUE_STATE.AFTER_REVENUE },
      ],
      overpaymentToStoreCredit: money(200),
    });
    expect(drafts).toHaveLength(2);
    expect(requireDraft(drafts[0]).postingKey).toBe(POSTING_KEY.payment_in_after_revenue);
    const overpayment = requireDraft(drafts[1]);
    expect(overpayment.postingKey).toBe(POSTING_KEY.overpayment_to_store_credit);
    expect(codesOf(overpayment.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CASH, debit: 200, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY, debit: 0, credit: 200 },
    ]);
  });

  it("posts refund of advance as CUSTOMER_ADVANCES / method", () => {
    const [entry] = draftPaymentRefund({
      paymentId: "p5",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(300),
      method: "NAGAD",
      direction: "REFUND",
      allocations: [
        { requestId: "r1", amount: money(300), revenueState: REVENUE_STATE.BEFORE_REVENUE },
      ],
    });
    const advance = requireDraft(entry);
    expect(advance.postingKey).toBe(POSTING_KEY.refund_advance);
    expect(codesOf(advance.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 300, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.NAGAD, debit: 0, credit: 300 },
    ]);
  });

  it("posts refund after revenue as AR / method", () => {
    const [entry] = draftPaymentRefund({
      paymentId: "p6",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(150),
      method: "BANK",
      direction: "REFUND",
      allocations: [
        { requestId: "r1", amount: money(150), revenueState: REVENUE_STATE.AFTER_REVENUE },
      ],
    });
    const after = requireDraft(entry);
    expect(after.postingKey).toBe(POSTING_KEY.refund_after_revenue);
    expect(codesOf(after.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 150, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.BANK, debit: 0, credit: 150 },
    ]);
  });

  it("posts store credit expiry as liability / OTHER_INCOME", () => {
    const entry = draftStoreCreditExpiry({
      storeCreditEntryId: "sc1",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(50),
      kind: "EXPIRY",
    });
    expect(entry.postingKey).toBe(POSTING_KEY.store_credit_expiry);
    expect(codesOf(entry.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY, debit: 50, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.OTHER_INCOME, debit: 0, credit: 50 },
    ]);
  });

  it("posts booking completed with tax and settles advances", () => {
    const snapshot: BookingPostingSnapshot = {
      bookingId: "b1",
      businessDate: "2026-10-19",
      locationId: null,
      kind: "SERVICE",
      revenueExcludingTax: money(900),
      tax: money(100),
      advancesToSettle: money(400),
    };
    const drafts = draftBookingCompleted(snapshot);
    const completed = requireDraft(drafts[0]);
    expect(completed.postingKey).toBe(POSTING_KEY.booking_completed);
    expect(codesOf(completed.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 1000, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE, debit: 0, credit: 900 },
      { code: SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, debit: 0, credit: 100 },
    ]);
    const settle = requireDraft(drafts[1]);
    expect(settle.postingKey).toBe(POSTING_KEY.booking_completed_settle_advances);
    expect(codesOf(settle.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 400, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 400 },
    ]);
  });

  it("posts cancellation fee retained", () => {
    const fee = requireDraft(
      draftCancellationFee({
        bookingId: "b2",
        businessDate: "2026-10-19",
        locationId: null,
        kind: "SERVICE",
        revenueExcludingTax: money(0),
        tax: money(0),
        advancesToSettle: money(0),
        cancellationFeeRetained: money(250),
      }),
    );
    expect(fee.postingKey).toBe(POSTING_KEY.cancellation_fee);
    expect(codesOf(fee.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 250, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME, debit: 0, credit: 250 },
    ]);
  });

  it("posts and voids an expense with mirrored lines", () => {
    const snapshot: ExpensePostingSnapshot = {
      expenseId: "e1",
      businessDate: "2026-10-19",
      locationId: "loc",
      amount: money(800),
      paidVia: "CASH",
      categoryAccountCode: "EXPENSE_RENT",
      status: "POSTED",
    };
    const posted = draftExpensePosted(snapshot);
    expect(posted.postingKey).toBe(POSTING_KEY.expense_posted);
    expect(codesOf(posted.lines)).toEqual([
      { code: "EXPENSE_RENT", debit: 800, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.CASH, debit: 0, credit: 800 },
    ]);
    const voided = draftExpenseVoided(snapshot, posted.lines, "journal-1");
    expect(voided.postingKey).toBe(POSTING_KEY.expense_voided);
    expect(voided.reversesJournalEntryId).toBe("journal-1");
    expect(codesOf(voided.lines)).toEqual([
      { code: "EXPENSE_RENT", debit: 0, credit: 800 },
      { code: SYSTEM_ACCOUNT_CODE.CASH, debit: 800, credit: 0 },
    ]);
  });

  it("throws on an unbalanced draft and writes nothing conceptually", () => {
    expect(() =>
      assertBalanced([
        { accountCode: "CASH", debit: money(100), credit: money(0) },
        { accountCode: "AR", debit: money(0), credit: money(90) },
      ]),
    ).toThrow(unbalancedJournal(100, 90).messageKey);
    expect(sumSide([{ accountCode: "CASH", debit: money(100), credit: money(0) }], "debit")).toBe(
      100,
    );
  });
});
