import type { CurrencyCode } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  METHOD_ACCOUNT_CODE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
  type SystemAccountCode,
} from "@banijjik/contracts/accounting";
import {
  STOCK_MOVEMENT_REASON,
  STOCK_RECEIPT_PAID_VIA,
  STOCK_SOURCE_TYPE,
  STOCK_STATE,
  type StockMovementReason,
  type StockReceiptPaidVia,
  type StockState,
} from "@banijjik/contracts/inventory";
import { postingSourceMissing } from "./errors.js";
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

export interface StockMovementPostingLine {
  readonly stockMovementId: string;
  readonly inventoryItemId: string;
  readonly quantityDelta: number;
  readonly stockState: StockState;
  readonly reason: StockMovementReason;
  readonly paidVia?: StockReceiptPaidVia;
  readonly value: Money;
}

export interface StockPostingSnapshot {
  readonly organizationId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly currency: CurrencyCode;
  readonly movements: readonly StockMovementPostingLine[];
}

function receiptCreditAccount(paidVia: StockReceiptPaidVia): SystemAccountCode | undefined {
  switch (paidVia) {
    case STOCK_RECEIPT_PAID_VIA.CASH:
      return METHOD_ACCOUNT_CODE.CASH;
    case STOCK_RECEIPT_PAID_VIA.BKASH:
      return METHOD_ACCOUNT_CODE.BKASH;
    case STOCK_RECEIPT_PAID_VIA.NAGAD:
      return METHOD_ACCOUNT_CODE.NAGAD;
    case STOCK_RECEIPT_PAID_VIA.BANK:
      return METHOD_ACCOUNT_CODE.BANK;
    case STOCK_RECEIPT_PAID_VIA.ON_CREDIT:
      return SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE;
    default:
      return undefined;
  }
}

function draftReceipt(snapshot: StockPostingSnapshot): DraftJournalEntry | undefined {
  const { sourceId, businessDate, locationId, currency, movements } = snapshot;
  const totalAmount = movements.reduce((sum, m) => sum + m.value.amount, 0);
  if (totalAmount <= 0) return undefined;

  const paidVia = movements[0]?.paidVia;
  if (paidVia === undefined) {
    throw postingSourceMissing("paidVia");
  }
  const creditAccount = receiptCreditAccount(paidVia);
  if (creditAccount === undefined) {
    throw postingSourceMissing(`method:${paidVia}`);
  }
  const totalMoney = { amount: totalAmount, currency };

  return entry({
    businessDate,
    locationId,
    sourceType: JOURNAL_SOURCE_TYPE.STOCK,
    sourceId,
    postingKey: POSTING_KEY.stock_receipt,
    lines: [debit(SYSTEM_ACCOUNT_CODE.INVENTORY, totalMoney), credit(creditAccount, totalMoney)],
  });
}

function draftOpening(snapshot: StockPostingSnapshot): DraftJournalEntry | undefined {
  const { sourceId, businessDate, locationId, currency, movements } = snapshot;
  const totalAmount = movements.reduce((sum, m) => sum + m.value.amount, 0);
  if (totalAmount <= 0) return undefined;

  const totalMoney = { amount: totalAmount, currency };
  return entry({
    businessDate,
    locationId,
    sourceType: JOURNAL_SOURCE_TYPE.STOCK,
    sourceId,
    postingKey: POSTING_KEY.stock_opening,
    lines: [
      debit(SYSTEM_ACCOUNT_CODE.INVENTORY, totalMoney),
      credit(SYSTEM_ACCOUNT_CODE.OPENING_BALANCE, totalMoney),
    ],
  });
}

function draftAdjustments(snapshot: StockPostingSnapshot): DraftJournalEntry | undefined {
  const { sourceId, businessDate, locationId, movements } = snapshot;
  const adjustmentMovements = movements.filter(
    (m) => m.reason === STOCK_MOVEMENT_REASON.ADJUSTMENT && m.value.amount > 0,
  );
  if (adjustmentMovements.length === 0) return undefined;

  const lines = adjustmentMovements.flatMap((m) => {
    if (m.quantityDelta > 0) {
      return [
        debit(SYSTEM_ACCOUNT_CODE.INVENTORY, m.value),
        credit(SYSTEM_ACCOUNT_CODE.OTHER_INCOME, m.value),
      ];
    }
    return [
      debit(SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, m.value),
      credit(SYSTEM_ACCOUNT_CODE.INVENTORY, m.value),
    ];
  });

  return entry({
    businessDate,
    locationId,
    sourceType: JOURNAL_SOURCE_TYPE.STOCK,
    sourceId,
    postingKey: POSTING_KEY.stock_adjustment,
    lines,
  });
}

function draftWriteOffs(snapshot: StockPostingSnapshot): DraftJournalEntry | undefined {
  const { sourceId, businessDate, locationId, movements } = snapshot;
  const writeOffMovements = movements.filter(
    (m) => m.reason === STOCK_MOVEMENT_REASON.DAMAGE_WRITE_OFF && m.value.amount > 0,
  );
  if (writeOffMovements.length === 0) return undefined;

  const lines = writeOffMovements.flatMap((m) => {
    const invCredit =
      m.stockState === STOCK_STATE.DAMAGED
        ? SYSTEM_ACCOUNT_CODE.INVENTORY_DAMAGED
        : SYSTEM_ACCOUNT_CODE.INVENTORY;
    return [debit(SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, m.value), credit(invCredit, m.value)];
  });

  return entry({
    businessDate,
    locationId,
    sourceType: JOURNAL_SOURCE_TYPE.STOCK,
    sourceId,
    postingKey: POSTING_KEY.stock_write_off,
    lines,
  });
}

export function draftStockSource(snapshot: StockPostingSnapshot): DraftJournalEntry[] {
  const isReceipt =
    snapshot.sourceType === STOCK_SOURCE_TYPE.STOCK_RECEIPT ||
    snapshot.movements.some((m) => m.reason === STOCK_MOVEMENT_REASON.PURCHASE);
  if (isReceipt) {
    const receipt = draftReceipt(snapshot);
    return receipt ? [receipt] : [];
  }

  const isOpening =
    snapshot.sourceType === STOCK_SOURCE_TYPE.STOCK_OPENING ||
    snapshot.movements.some((m) => m.reason === STOCK_MOVEMENT_REASON.OPENING);
  if (isOpening) {
    const opening = draftOpening(snapshot);
    return opening ? [opening] : [];
  }

  const drafts: DraftJournalEntry[] = [];
  const adjustment = draftAdjustments(snapshot);
  if (adjustment) drafts.push(adjustment);

  const writeOff = draftWriteOffs(snapshot);
  if (writeOff) drafts.push(writeOff);

  return drafts;
}
