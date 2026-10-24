import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";
import type { SystemAccountCode } from "./system-account-code.js";

/** Money in JSON: integer minor units plus currency (05-CONVENTIONS, ADR-013). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export const ACCOUNT_TYPE = defineEnum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);
export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

export const ACCOUNT_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

/**
 * Why a journal entry was posted. One entry per (sourceType, sourceId, postingKey) (11 §10).
 * Later cards add ORDER, STOCK, RETURN and COD keys; the codes exist now.
 */
export const JOURNAL_SOURCE_TYPE = defineEnum([
  "PAYMENT",
  "BOOKING",
  "EXPENSE",
  "STORE_CREDIT",
  "ORDER",
  "STOCK",
  "RETURN",
  "COURIER",
  "MANUAL",
  "COMMISSION",
]);
export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPE)[keyof typeof JOURNAL_SOURCE_TYPE];

/**
 * Distinguishes multiple postings for the same source record (11 §10 matrix rows built in 3.8c).
 * Rows for order, stock, return and COD arrive with their cards.
 */
export const POSTING_KEY = defineEnum([
  "payment_in_advance",
  "payment_in_after_revenue",
  "payment_store_credit",
  "overpayment_to_store_credit",
  "refund_advance",
  "refund_after_revenue",
  "reversal",
  "reversal_payment_in_advance",
  "reversal_payment_in_after_revenue",
  "reversal_payment_store_credit",
  "reversal_overpayment_to_store_credit",
  "booking_completed",
  "booking_completed_settle_advances",
  "cancellation_fee",
  "store_credit_expiry",
  "expense_posted",
  "expense_voided",
  "rounding",
  "commission_accrued",
  "commission_adjusted",
  "commission_paid",
  "order_revenue",
  "order_advance_settle",
  "order_cost",
  "stock_receipt",
  "stock_opening",
  "stock_adjustment",
  "stock_write_off",
  "bad_debt_written_off",
]);
export type PostingKey =
  (typeof POSTING_KEY)[keyof typeof POSTING_KEY] | `manual:${string}` | `reversal:${string}`;

export function reversalPostingKeyFor(originalKey: PostingKey): PostingKey {
  switch (originalKey) {
    case POSTING_KEY.payment_in_advance:
      return POSTING_KEY.reversal_payment_in_advance;
    case POSTING_KEY.payment_in_after_revenue:
      return POSTING_KEY.reversal_payment_in_after_revenue;
    case POSTING_KEY.payment_store_credit:
      return POSTING_KEY.reversal_payment_store_credit;
    case POSTING_KEY.overpayment_to_store_credit:
      return POSTING_KEY.reversal_overpayment_to_store_credit;
    default:
      return POSTING_KEY.reversal;
  }
}

/** Whether allocated money sits as a liability (before revenue) or settles AR (after). */
export const REVENUE_STATE = defineEnum(["BEFORE_REVENUE", "AFTER_REVENUE"]);
export type RevenueState = (typeof REVENUE_STATE)[keyof typeof REVENUE_STATE];

export const ACCOUNTING_FISCAL_YEAR_START_SETTING_KEY = "accounting.fiscalYearStart";

/** Default fiscal year start: 1 July (Bangladesh common practice); day-of-year 1–366 as INTEGER. */
export const ACCOUNTING_FISCAL_YEAR_START_DEFAULT = 182;

/** Organization setting: a sole OWNER may post manual journal entries without approval (default true). */
export const BOOKKEEPING_MANUAL_ENTRY_OWNER_WITHOUT_APPROVAL_SETTING_KEY =
  "bookkeeping.manualEntryOwnerWithoutApproval";

export interface LocalizedAccountName {
  readonly bn: string;
  readonly en: string;
}

export interface AccountResponse {
  readonly balance?: Money;
  readonly version: number;
  readonly parentAccountCode: string | null;
  readonly accountId: string;
  readonly accountCode: string;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly isSystem: boolean;
  readonly status: AccountStatus;
}

export interface JournalLineResponse {
  readonly accountId: string;
  readonly accountCode: string;
  readonly debit: Money;
  readonly credit: Money;
}

export interface JournalEntryResponse {
  readonly memo?: string | null;
  readonly journalEntryId: string;
  readonly entryNumber: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly lines: readonly JournalLineResponse[];
  readonly sourceType: JournalSourceType;
  readonly sourceId: string;
  readonly postingKey: PostingKey;
  readonly reversesJournalEntryId: string | null;
  readonly createdAt: string;
}

export interface TrialBalanceAccountRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly debitTotal: Money;
  readonly creditTotal: Money;
  readonly balance: Money;
}

export interface TrialBalanceResponse {
  readonly asOf: string;
  readonly accounts: readonly TrialBalanceAccountRow[];
  readonly debitTotal: Money;
  readonly creditTotal: Money;
  /** True when debitTotal equals creditTotal (books balance). */
  readonly balances: boolean;
}

/** System account seed row: code, type and i18n name keys resolved at seed time. */
export interface SystemAccountSeed {
  readonly accountCode: SystemAccountCode;
  readonly accountType: AccountType;
  readonly name: LocalizedAccountName;
}

/** `POST /bookkeeping/accounts` (3.8b). */
export interface AccountCreateRequest {
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly parentAccountCode?: string | undefined;
}

/** `PATCH /bookkeeping/accounts/{accountId}` (3.8b). */
export interface AccountUpdateRequest {
  readonly version: number;
  readonly name?: LocalizedAccountName | undefined;
  readonly status?: AccountStatus | undefined;
}

/** `POST /bookkeeping/journal/manual` (3.8b). */
export interface ManualJournalEntryRequest {
  readonly businessDate: string;
  readonly locationId?: string | undefined;
  readonly memo: string;
  readonly approvalToken?: string | undefined;
  readonly lines: readonly ManualJournalLine[];
}

export interface ManualJournalLine {
  readonly accountId: string;
  readonly debit?: Money | undefined;
  readonly credit?: Money | undefined;
}

/** `GET /bookkeeping/statements/profit-and-loss` (3.8b). */
export interface ProfitAndLossStatementRequest {
  readonly from: string;
  readonly to: string;
  readonly locationId?: string | undefined;
}

export interface ProfitAndLossStatementRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly incomeTotal: Money;
  readonly expenseTotal: Money;
  readonly net: Money;
}

export interface ProfitAndLossStatementResponse {
  readonly from: string;
  readonly to: string;
  readonly accounts: readonly ProfitAndLossStatementRow[];
  readonly totalIncome: Money;
  readonly totalExpense: Money;
  readonly netProfit: Money;
}

/** `GET /bookkeeping/statements/balance-sheet` (3.8b). */
export interface BalanceSheetRequest {
  readonly asOf: string;
}

export interface BalanceSheetRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly balance: Money;
}

export interface BalanceSheetResponse {
  readonly asOf: string;
  readonly assets: readonly BalanceSheetRow[];
  readonly liabilities: readonly BalanceSheetRow[];
  readonly equity: readonly BalanceSheetRow[];
  readonly retainedEarnings: Money;
  readonly totalAssets: Money;
  readonly totalLiabilities: Money;
  readonly totalEquity: Money;
  /** True when assets = liabilities + equity + retained earnings. */
  readonly isBalanced: boolean;
}

export const MANUAL_JOURNAL_MIN_LINES = 2;
export const MANUAL_JOURNAL_MAX_LINES = 20;
