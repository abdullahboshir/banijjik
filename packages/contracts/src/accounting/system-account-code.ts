import { defineEnum } from "../define-enum.js";

/**
 * Fixed codes of the system chart of accounts (11 §10). Resolution is by code only (ADR-124).
 * Expense category accounts use other codes created per organization.
 */
export const SYSTEM_ACCOUNT_CODE = defineEnum([
  "CASH",
  "BKASH",
  "NAGAD",
  "BANK",
  "CARD_CLEARING",
  "GATEWAY_CLEARING",
  "COURIER_RECEIVABLE",
  "RIDER_CASH",
  "ACCOUNTS_RECEIVABLE",
  "INVENTORY",
  "INVENTORY_DAMAGED",
  "CUSTOMER_ADVANCES",
  "STORE_CREDIT_LIABILITY",
  "TAX_PAYABLE",
  "REVENUE_PRODUCT",
  "REVENUE_SERVICE",
  "REVENUE_PLAN",
  "REVENUE_RENTAL",
  "REVENUE_EVENT",
  "DELIVERY_INCOME",
  "CANCELLATION_FEE_INCOME",
  "OTHER_INCOME",
  "SALES_DISCOUNTS",
  "SALES_RETURNS",
  "COGS",
  "DAMAGE_LOSS",
  "DELIVERY_EXPENSE",
  "COURIER_FEES",
  "ROUNDING",
  "OWNER_EQUITY",
  "OPENING_BALANCE",
  "COMMISSION_EXPENSE",
  "COMMISSION_PAYABLE",
]);

export type SystemAccountCode = (typeof SYSTEM_ACCOUNT_CODE)[keyof typeof SYSTEM_ACCOUNT_CODE];

/** Maps a payment or expense method to the system asset account that holds the cash movement. */
export const METHOD_ACCOUNT_CODE = Object.freeze({
  CASH: SYSTEM_ACCOUNT_CODE.CASH,
  BKASH: SYSTEM_ACCOUNT_CODE.BKASH,
  NAGAD: SYSTEM_ACCOUNT_CODE.NAGAD,
  BANK: SYSTEM_ACCOUNT_CODE.BANK,
  CARD: SYSTEM_ACCOUNT_CODE.CARD_CLEARING,
  STORE_CREDIT: SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY,
} as const);
