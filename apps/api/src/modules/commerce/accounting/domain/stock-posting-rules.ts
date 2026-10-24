import type { CurrencyCode } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  METHOD_ACCOUNT_CODE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import type {
  StockMovementReason,
  StockReceiptPaidVia,
  StockState,
} from "@banijjik/contracts/inventory";
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

function draftReceipt(snapshot: StockPostingSnapshot): DraftJournalEntry | undefined {
  const { sourceId, businessDate, locationId, currency, movements } = snapshot;
  const totalAmount = movements.reduce((sum, m) => sum + m.value.amount, 0);
  if (totalAmount <= 0) return undefined;

  const paidVia = movements[0]?.paidVia ?? "CASH";
  const creditAccount =
    paidVia === "ON_CREDIT"
      ? SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE
      : (METHOD_ACCOUNT_CODE[paidVia as keyof typeof METHOD_ACCOUNT_CODE] ??
        SYSTEM_ACCOUNT_CODE.CASH);
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
    (m) => m.reason === "ADJUSTMENT" && m.value.amount > 0,
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
    (m) => m.reason === "DAMAGE_WRITE_OFF" && m.value.amount > 0,
  );
  if (writeOffMovements.length === 0) return undefined;

  const lines = writeOffMovements.flatMap((m) => {
    const invCredit =
      m.stockState === "DAMAGED"
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
    snapshot.sourceType === "STOCK_RECEIPT" ||
    snapshot.movements.some((m) => m.reason === "PURCHASE");
  if (isReceipt) {
    const receipt = draftReceipt(snapshot);
    return receipt ? [receipt] : [];
  }

  const isOpening =
    snapshot.sourceType === "STOCK_OPENING" ||
    snapshot.movements.some((m) => m.reason === "OPENING");
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
