import { defineEnum } from "../define-enum.js";
import type { Money, PaymentMethod } from "../payment/payment-contracts.js";
import type { OrderResponse } from "./sales-contracts.js";
import type { SalesReturnPreviewResponse, SalesReturnResponse } from "./sales-return-contracts.js";

/**
 * Methods a customer may pay the new order of an exchange with (plan 3.5b E2). STORE_CREDIT is
 * never named by the client: the server spends the credit the return created.
 */
export const SALES_EXCHANGE_PAYMENT_METHODS = defineEnum([
  "CASH",
  "BKASH",
  "NAGAD",
  "BANK",
  "CARD",
]);
export type SalesExchangePaymentMethod =
  (typeof SALES_EXCHANGE_PAYMENT_METHODS)[keyof typeof SALES_EXCHANGE_PAYMENT_METHODS];

/** At most this many payments on one exchange (plan 3.5b E2). */
export const MAX_EXCHANGE_PAYMENTS = 5;

/** One payment taken on the new order of an exchange, the store-credit spend included. */
export interface SalesExchangePaymentResponse {
  readonly paymentId: string;
  readonly paymentNumber: string;
  readonly method: PaymentMethod;
  readonly amount: Money;
}

/** The result of an exchange: the return, the new order, its payments and the credit numbers. */
export interface SalesExchangeResponse {
  readonly salesReturn: SalesReturnResponse;
  readonly order: OrderResponse;
  readonly payments: readonly SalesExchangePaymentResponse[];
  /** The part of this return's store credit that paid the new order. */
  readonly storeCreditUsed: Money;
  /** The part of this return's store credit that is still on the contact's balance. */
  readonly storeCreditLeft: Money;
  /** What the new order still owes after the credit and the payments. */
  readonly dueAmount: Money;
}

/** The preview of an exchange: the same numbers as the create, nothing is saved. */
export interface SalesExchangePreviewResponse {
  readonly salesReturn: SalesReturnPreviewResponse;
  readonly orderGrandTotal: Money;
  readonly storeCreditUsed: Money;
  readonly storeCreditLeft: Money;
  readonly dueAmount: Money;
}
