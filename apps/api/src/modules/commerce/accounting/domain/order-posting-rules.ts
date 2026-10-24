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

function entry(
  input: Omit<DraftJournalEntry, "lines"> & { readonly lines: readonly DraftJournalLine[] },
): DraftJournalEntry {
  assertBalanced(input.lines);
  return input;
}

export interface OrderPostingSnapshot {
  readonly orderId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly totals: {
    readonly subtotal: Money;
    readonly discountTotal: Money;
    readonly taxTotal: Money;
    readonly deliveryCharge: Money;
    readonly grandTotal: Money;
    readonly roundingAdjustment: Money;
  };
  readonly advancesToSettle: Money;
  readonly cogs: Money;
}

function buildDebitLines(
  grandTotal: Money,
  discountTotal: Money,
  roundingAdjustment: Money,
): DraftJournalLine[] {
  const lines: DraftJournalLine[] = [];
  if (grandTotal.amount > 0) {
    lines.push(debit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, grandTotal));
  }
  if (discountTotal.amount > 0) {
    lines.push(debit(SYSTEM_ACCOUNT_CODE.SALES_DISCOUNTS, discountTotal));
  }
  if (roundingAdjustment.amount < 0) {
    lines.push(
      debit(SYSTEM_ACCOUNT_CODE.ROUNDING, {
        amount: -roundingAdjustment.amount,
        currency: grandTotal.currency,
      }),
    );
  }
  return lines;
}

function buildCreditLines(
  totals: OrderPostingSnapshot["totals"],
  goodsAmount: number,
): DraftJournalLine[] {
  const lines: DraftJournalLine[] = [];
  const currency = totals.grandTotal.currency;
  if (goodsAmount > 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT, { amount: goodsAmount, currency }));
  }
  if (totals.taxTotal.amount > 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.TAX_PAYABLE, totals.taxTotal));
  }
  if (totals.deliveryCharge.amount > 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.DELIVERY_INCOME, totals.deliveryCharge));
  }
  if (totals.roundingAdjustment.amount > 0) {
    lines.push(credit(SYSTEM_ACCOUNT_CODE.ROUNDING, totals.roundingAdjustment));
  }
  return lines;
}

export function draftOrderCompleted(snapshot: OrderPostingSnapshot): DraftJournalEntry[] {
  const { orderId, businessDate, locationId, totals, advancesToSettle, cogs } = snapshot;
  const drafts: DraftJournalEntry[] = [];

  const goodsAmount =
    totals.grandTotal.amount +
    totals.discountTotal.amount -
    totals.taxTotal.amount -
    totals.deliveryCharge.amount -
    totals.roundingAdjustment.amount;

  const debits = buildDebitLines(
    totals.grandTotal,
    totals.discountTotal,
    totals.roundingAdjustment,
  );
  const credits = buildCreditLines(totals, goodsAmount);
  const revenueLines = [...debits, ...credits];

  if (revenueLines.length > 0) {
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderId,
        postingKey: POSTING_KEY.order_revenue,
        lines: revenueLines,
      }),
    );
  }

  if (advancesToSettle.amount > 0) {
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderId,
        postingKey: POSTING_KEY.order_advance_settle,
        lines: [
          debit(SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, advancesToSettle),
          credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, advancesToSettle),
        ],
      }),
    );
  }

  if (cogs.amount > 0) {
    drafts.push(
      entry({
        businessDate,
        locationId,
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderId,
        postingKey: POSTING_KEY.order_cost,
        lines: [debit(SYSTEM_ACCOUNT_CODE.COGS, cogs), credit(SYSTEM_ACCOUNT_CODE.INVENTORY, cogs)],
      }),
    );
  }

  return drafts;
}
