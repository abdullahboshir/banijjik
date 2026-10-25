import type { CurrencyCode } from "@banijjik/contracts";
import { PAYMENT_METHOD, type Money, type PaymentMethod } from "@banijjik/contracts/payment";
import { POS_MAX_SALE_PAYMENTS } from "@banijjik/contracts/pos";

/**
 * Non-cash tender rows the cashier types. Cash is never typed: it is whatever the bill still needs
 * after these rows, so the amounts always add up to the quoted total (plan 3.9 decision 4).
 */
export interface TenderRow {
  readonly rowKey: string;
  readonly method: PaymentMethod;
  readonly amountMinor: number;
}

export interface TenderInput {
  readonly totalMinor: number;
  readonly currency: CurrencyCode;
  readonly rows: readonly TenderRow[];
  /** What the customer hands over in cash. Change is this minus the cash part of the bill. */
  readonly cashReceivedMinor: number;
}

export type TenderRefusal = "invalidAmount" | "overpaymentNotCash" | "cashShort" | "tooManyRows";

export type TenderPlan =
  | {
      readonly ok: true;
      readonly payments: readonly { readonly method: PaymentMethod; readonly amount: Money }[];
      /** Sent only when some cash applies to the bill; the server computes the same change. */
      readonly cashTendered: Money | null;
      readonly changeMinor: number;
    }
  | { readonly ok: false; readonly refusal: TenderRefusal };

const NON_CASH_METHODS: readonly PaymentMethod[] = [
  PAYMENT_METHOD.BKASH,
  PAYMENT_METHOD.NAGAD,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.BANK,
];

export function isTillNonCashMethod(method: PaymentMethod): boolean {
  return NON_CASH_METHODS.includes(method);
}

function isValidMinor(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Refuses a cash row (cash is never typed), a negative, fractional or unsafe amount, before any sum is taken. */
function rowsAreValid(rows: readonly TenderRow[]): boolean {
  return rows.every((row) => isTillNonCashMethod(row.method) && isValidMinor(row.amountMinor));
}

function sumMinor(rows: readonly TenderRow[]): number {
  return rows.reduce((total, row) => total + row.amountMinor, 0);
}

/** A non-cash row above what the bill still needs is refused: only cash may be handed back as change. */
function refusalForRows(input: TenderInput, nonCashMinor: number): TenderRefusal | null {
  if (!rowsAreValid(input.rows) || !isValidMinor(input.cashReceivedMinor)) return "invalidAmount";
  if (nonCashMinor > input.totalMinor) return "overpaymentNotCash";
  return null;
}

function refusalForCash(cashAppliedMinor: number, cashReceivedMinor: number): TenderRefusal | null {
  if (cashAppliedMinor === 0) return null;
  return cashReceivedMinor < cashAppliedMinor ? "cashShort" : null;
}

function payingRowsOf(input: TenderInput): readonly TenderRow[] {
  return input.rows.filter((row) => row.amountMinor > 0);
}

/**
 * Splits the bill between the non-cash rows and cash, and works out the change. Integer math only
 * (ADR-013). The server re-checks everything; this keeps a wrong amount off the wire.
 */
export function planTender(input: TenderInput): TenderPlan {
  const paying = payingRowsOf(input);
  const nonCashMinor = sumMinor(paying);
  const refusal = refusalForRows(input, nonCashMinor);
  if (refusal) return { ok: false, refusal };
  const cashAppliedMinor = input.totalMinor - nonCashMinor;
  const cashRefusal = refusalForCash(cashAppliedMinor, input.cashReceivedMinor);
  if (cashRefusal) return { ok: false, refusal: cashRefusal };
  const cashRows = cashAppliedMinor > 0 ? 1 : 0;
  if (paying.length + cashRows > POS_MAX_SALE_PAYMENTS)
    return { ok: false, refusal: "tooManyRows" };
  return buildPlan(input, paying, cashAppliedMinor);
}

function buildPlan(
  input: TenderInput,
  paying: readonly TenderRow[],
  cashAppliedMinor: number,
): TenderPlan {
  const cashPayments =
    cashAppliedMinor > 0
      ? [
          {
            method: PAYMENT_METHOD.CASH,
            amount: { amount: cashAppliedMinor, currency: input.currency },
          },
        ]
      : [];
  const otherPayments = paying.map((row) => ({
    method: row.method,
    amount: { amount: row.amountMinor, currency: input.currency },
  }));
  return {
    ok: true,
    payments: [...cashPayments, ...otherPayments],
    cashTendered:
      cashAppliedMinor > 0 ? { amount: input.cashReceivedMinor, currency: input.currency } : null,
    changeMinor: cashAppliedMinor > 0 ? input.cashReceivedMinor - cashAppliedMinor : 0,
  };
}

/** Cash buttons: the exact amount, then the next round figure at 100, 500 and 1000 in major units. */
const ROUND_STEPS_MAJOR = [100, 500, 1000] as const;
const MINOR_PER_MAJOR = 100;

function roundUpTo(amountMinor: number, stepMinor: number): number {
  return Math.floor((amountMinor + stepMinor - 1) / stepMinor) * stepMinor;
}

/** The quick-cash figures for a bill: the exact amount first, then distinct round figures above it. */
export function quickCashOptions(totalMinor: number): readonly number[] {
  const roundFigures = ROUND_STEPS_MAJOR.map((step) =>
    roundUpTo(totalMinor, step * MINOR_PER_MAJOR),
  );
  const candidates = [totalMinor, ...roundFigures];
  return candidates.filter((value, index) => candidates.indexOf(value) === index);
}
