import { POSTING_KEY, REVENUE_STATE, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { describe, expect, it } from "vitest";
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
import { draftOrderCompleted } from "./order-posting-rules.js";
import { draftStockSource } from "./stock-posting-rules.js";

const money = (amount: number) => ({ amount, currency: "BDT" as const });

function codesOf(
  lines?: readonly { accountCode: string; debit: { amount: number }; credit: { amount: number } }[],
) {
  return (lines ?? []).map((line) => ({
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

  it("drafts order completed: revenue, tax, discount, delivery, rounding and balance", () => {
    const drafts = draftOrderCompleted({
      orderId: "ord-1",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      totals: {
        subtotal: money(1000),
        discountTotal: money(100),
        taxTotal: money(50),
        deliveryCharge: money(60),
        grandTotal: money(1010),
        roundingAdjustment: money(0),
      },
      advancesToSettle: money(200),
      serviceGoods: money(0),
      cogs: money(400),
    });

    expect(drafts).toHaveLength(3);
    const [rev, settle, cogs] = drafts;

    expect(rev?.postingKey).toBe(POSTING_KEY.order_revenue);
    expect(codesOf(rev?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 1010, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.SALES_DISCOUNTS, debit: 100, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT, debit: 0, credit: 1000 },
      { code: SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, debit: 0, credit: 50 },
      { code: SYSTEM_ACCOUNT_CODE.DELIVERY_INCOME, debit: 0, credit: 60 },
    ]);

    expect(settle?.postingKey).toBe(POSTING_KEY.order_advance_settle);
    expect(codesOf(settle?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 200, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 200 },
    ]);

    expect(cogs?.postingKey).toBe(POSTING_KEY.order_cost);
    expect(codesOf(cogs?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.COGS, debit: 400, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 0, credit: 400 },
    ]);
  });

  it("handles rounding adjustment debit (rounded down) and credit (rounded up)", () => {
    // Rounded up: grandTotal + 2
    const roundedUp = draftOrderCompleted({
      orderId: "ord-up",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      totals: {
        subtotal: money(98),
        discountTotal: money(0),
        taxTotal: money(0),
        deliveryCharge: money(0),
        grandTotal: money(100),
        roundingAdjustment: money(2),
      },
      advancesToSettle: money(0),
      serviceGoods: money(0),
      cogs: money(0),
    });
    expect(codesOf(roundedUp[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 100, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT, debit: 0, credit: 98 },
      { code: SYSTEM_ACCOUNT_CODE.ROUNDING, debit: 0, credit: 2 },
    ]);

    // Rounded down: grandTotal - 2
    const roundedDown = draftOrderCompleted({
      orderId: "ord-down",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      totals: {
        subtotal: money(102),
        discountTotal: money(0),
        taxTotal: money(0),
        deliveryCharge: money(0),
        grandTotal: money(100),
        roundingAdjustment: money(-2),
      },
      advancesToSettle: money(0),
      serviceGoods: money(0),
      cogs: money(0),
    });
    expect(codesOf(roundedDown[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 100, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.ROUNDING, debit: 2, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT, debit: 0, credit: 102 },
    ]);
  });

  it("derives tax-exclusive goods amount for tax-inclusive and tax-exclusive orders", () => {
    // Tax-inclusive: 1000 subtotal includes 100 tax, 0 discount, 0 delivery
    // grandTotal = 1000, taxTotal = 100
    // goodsAmountExclTax = 1000 + 0 - 100 - 0 - 0 = 900
    const inclusive = draftOrderCompleted({
      orderId: "ord-inc",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      totals: {
        subtotal: money(1000),
        discountTotal: money(0),
        taxTotal: money(100),
        deliveryCharge: money(0),
        grandTotal: money(1000),
        roundingAdjustment: money(0),
      },
      advancesToSettle: money(0),
      serviceGoods: money(0),
      cogs: money(0),
    });
    expect(codesOf(inclusive[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 1000, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT, debit: 0, credit: 900 },
      { code: SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, debit: 0, credit: 100 },
    ]);
  });

  it("drafts stock receipts for CASH, BKASH, NAGAD, BANK and ON_CREDIT", () => {
    const methods: readonly ["CASH" | "BKASH" | "NAGAD" | "BANK" | "ON_CREDIT", string][] = [
      ["CASH", SYSTEM_ACCOUNT_CODE.CASH],
      ["BKASH", SYSTEM_ACCOUNT_CODE.BKASH],
      ["NAGAD", SYSTEM_ACCOUNT_CODE.NAGAD],
      ["BANK", SYSTEM_ACCOUNT_CODE.BANK],
      ["ON_CREDIT", SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE],
    ];

    for (const [paidVia, expectedAccount] of methods) {
      const drafts = draftStockSource({
        organizationId: "org-1",
        sourceType: "STOCK_RECEIPT",
        sourceId: `rcpt-${paidVia}`,
        businessDate: "2026-10-24",
        locationId: "loc-1",
        currency: "BDT",
        movements: [
          {
            stockMovementId: "sm-1",
            inventoryItemId: "item-1",
            quantityDelta: 10,
            stockState: "SELLABLE",
            reason: "PURCHASE",
            paidVia,
            value: money(500),
          },
        ],
      });
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.postingKey).toBe(POSTING_KEY.stock_receipt);
      expect(codesOf(drafts[0]?.lines)).toEqual([
        { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 500, credit: 0 },
        { code: expectedAccount, debit: 0, credit: 500 },
      ]);
    }
  });

  it("drafts stock opening, adjustment up/down and damage write-off", () => {
    // Opening
    const opening = draftStockSource({
      organizationId: "org-1",
      sourceType: "STOCK_OPENING",
      sourceId: "op-1",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      currency: "BDT",
      movements: [
        {
          stockMovementId: "sm-op",
          inventoryItemId: "item-1",
          quantityDelta: 100,
          stockState: "SELLABLE",
          reason: "OPENING",
          value: money(5000),
        },
      ],
    });
    expect(codesOf(opening[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 5000, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.OPENING_BALANCE, debit: 0, credit: 5000 },
    ]);

    // Adjustment up and down in same source
    const adj = draftStockSource({
      organizationId: "org-1",
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: "adj-1",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      currency: "BDT",
      movements: [
        {
          stockMovementId: "sm-up",
          inventoryItemId: "item-1",
          quantityDelta: 5,
          stockState: "SELLABLE",
          reason: "ADJUSTMENT",
          value: money(250),
        },
        {
          stockMovementId: "sm-down",
          inventoryItemId: "item-2",
          quantityDelta: -2,
          stockState: "SELLABLE",
          reason: "ADJUSTMENT",
          value: money(100),
        },
      ],
    });
    expect(codesOf(adj[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 250, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.OTHER_INCOME, debit: 0, credit: 250 },
      { code: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, debit: 100, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 0, credit: 100 },
    ]);

    // Damage write-off: sellable vs damaged stockState
    const writeOff = draftStockSource({
      organizationId: "org-1",
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: "wo-1",
      businessDate: "2026-10-24",
      locationId: "loc-1",
      currency: "BDT",
      movements: [
        {
          stockMovementId: "sm-dam",
          inventoryItemId: "item-1",
          quantityDelta: -1,
          stockState: "DAMAGED",
          reason: "DAMAGE_WRITE_OFF",
          value: money(50),
        },
        {
          stockMovementId: "sm-sel",
          inventoryItemId: "item-2",
          quantityDelta: -1,
          stockState: "SELLABLE",
          reason: "DAMAGE_WRITE_OFF",
          value: money(80),
        },
      ],
    });
    expect(codesOf(writeOff[0]?.lines)).toEqual([
      { code: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, debit: 50, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY_DAMAGED, debit: 0, credit: 50 },
      { code: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, debit: 80, credit: 0 },
      { code: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: 0, credit: 80 },
    ]);
  });
});
