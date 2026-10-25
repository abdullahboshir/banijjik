import { defineEnum } from "../define-enum.js";
import type { Money } from "../pricing/pricing-contracts.js";

/**
 * What happened to a returned line's goods (plan 3.5b decision 1). RESTOCK goes back on the shelf,
 * DAMAGED goes to damaged stock, NOT_RECEIVED never reached the customer, so no stock moves.
 */
export const RETURN_DISPOSITION = defineEnum(["RESTOCK", "DAMAGED", "NOT_RECEIVED"]);
export type ReturnDisposition = (typeof RETURN_DISPOSITION)[keyof typeof RETURN_DISPOSITION];

export const SALES_RETURN_STATUS = defineEnum(["ACTIVE", "REVERSED"]);
export type SalesReturnStatus = (typeof SALES_RETURN_STATUS)[keyof typeof SALES_RETURN_STATUS];

/** Summary of an order's returns, read from the order projection (plan 3.5b decision 7). */
export const ORDER_RETURN_STATUS = defineEnum(["NONE", "PARTIAL", "FULL"]);
export type OrderReturnStatus = (typeof ORDER_RETURN_STATUS)[keyof typeof ORDER_RETURN_STATUS];

/** Reasons a staff member picks for a return. OTHER needs a note (plan 3.5b decision 11). */
export const SALES_RETURN_REASON = defineEnum([
  "DEFECTIVE",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
  "NOT_DELIVERED",
  "OTHER",
]);
export type SalesReturnReason = (typeof SALES_RETURN_REASON)[keyof typeof SALES_RETURN_REASON];

/** Refund methods a return may pay out with; GATEWAY is refused until Phase 5 (plan decision 5). */
export const SALES_RETURN_REFUND_METHOD = defineEnum([
  "CASH",
  "BKASH",
  "NAGAD",
  "BANK",
  "CARD",
  "STORE_CREDIT",
]);
export type SalesReturnRefundMethod =
  (typeof SALES_RETURN_REFUND_METHOD)[keyof typeof SALES_RETURN_REFUND_METHOD];

export const MAX_SALES_RETURN_NOTE_LENGTH = 500;
export const SALES_RETURN_LIST_MAX_LIMIT = 100;

/** Settings of the returns module (plan 3.5b decision 2). */
export const SALES_RETURN_WINDOW_DAYS_SETTING_KEY = "sales.returnWindowDays";
export const SALES_RETURN_WINDOW_DAYS_DEFAULT = 7;

export interface SalesReturnLineResponse {
  readonly orderLineId: string;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
  readonly value: Money;
  readonly taxPart: Money;
}

export interface SalesReturnRefundResponse {
  readonly method: SalesReturnRefundMethod | null;
  readonly amount: Money;
  readonly paymentId: string | null;
  readonly storeCreditEntryId: string | null;
}

export interface SalesReturnApprovalResponse {
  readonly action: string;
  readonly approvalId: string;
  readonly approverMemberId: string;
  readonly approvedAt: string;
}

export interface SalesReturnResponse {
  readonly salesReturnId: string;
  readonly salesReturnNumber: string;
  readonly orderId: string;
  readonly locationId: string;
  readonly contactId: string | null;
  readonly lines: readonly SalesReturnLineResponse[];
  readonly deliveryChargeReturned: Money;
  readonly roundingReturned: Money;
  readonly value: Money;
  readonly refund: SalesReturnRefundResponse;
  readonly dueReduced: Money;
  readonly reasonKey: SalesReturnReason;
  readonly note: string | null;
  readonly approvals: readonly SalesReturnApprovalResponse[];
  readonly status: SalesReturnStatus;
  readonly reversal: {
    readonly reversedAt: string;
    readonly reversedByUserId: string;
    readonly reasonKey: string;
    readonly note: string | null;
    readonly paybackPaymentId: string | null;
    readonly approval: {
      readonly action: string;
      readonly approvalId: string;
      readonly approverMemberId: string;
      readonly approvedAt: string;
    };
  } | null;
  readonly exchangeOrderId: string | null;
  readonly businessDate: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of the returns list: no line detail. */
export interface SalesReturnListItem {
  readonly salesReturnId: string;
  readonly salesReturnNumber: string;
  readonly orderId: string;
  readonly value: Money;
  readonly refundAmount: Money;
  readonly reasonKey: SalesReturnReason;
  readonly status: SalesReturnStatus;
  readonly businessDate: string;
  readonly createdAt: string;
}

/** The preview of a return: the same numbers the create writes, nothing is saved. */
export interface SalesReturnPreviewResponse {
  readonly lines: readonly SalesReturnLineResponse[];
  readonly deliveryChargeReturned: Money;
  readonly roundingReturned: Money;
  readonly value: Money;
  readonly dueReduced: Money;
  readonly refundAmount: Money;
  readonly requiresRefundApproval: boolean;
  readonly requiresNotReceivedApproval: boolean;
}
