import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";

/** Money in JSON: integer minor units plus currency (ADR-013). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export const PAYMENT_DIRECTION = defineEnum(["IN", "REFUND", "REVERSAL"]);
export type PaymentDirection = (typeof PAYMENT_DIRECTION)[keyof typeof PAYMENT_DIRECTION];

export const PAYMENT_METHOD = defineEnum([
  "CASH",
  "BKASH",
  "NAGAD",
  "BANK",
  "CARD",
  "STORE_CREDIT",
  "GATEWAY",
  "COD_COURIER",
  "RIDER_CASH",
]);
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

/** Methods currently accepted in card 3.8. Others are refused until their cards. */
export const ACCEPTED_PAYMENT_METHODS: readonly PaymentMethod[] = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.BKASH,
  PAYMENT_METHOD.NAGAD,
  PAYMENT_METHOD.BANK,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.STORE_CREDIT,
];

export const PAYMENT_REQUEST_TYPE = defineEnum(["BOOKING", "ORDER", "ENROLLMENT"]);
export type PaymentRequestType = (typeof PAYMENT_REQUEST_TYPE)[keyof typeof PAYMENT_REQUEST_TYPE];

export const PAYMENT_STATUS = defineEnum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]);
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const STORE_CREDIT_ENTRY_KIND = defineEnum([
  "PAYMENT_OVERPAYMENT",
  "PAYMENT_USE",
  "MANUAL_ADJUSTMENT",
  "EXPIRY",
]);
export type StoreCreditEntryKind =
  (typeof STORE_CREDIT_ENTRY_KIND)[keyof typeof STORE_CREDIT_ENTRY_KIND];

export const STORE_CREDIT_DIRECTION = defineEnum(["CREDIT", "DEBIT"]);
export type StoreCreditDirection =
  (typeof STORE_CREDIT_DIRECTION)[keyof typeof STORE_CREDIT_DIRECTION];

export const PAYMENT_METHODS_SETTING_KEY = "payment.methods";
export const PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY =
  "payment.refund.managerWithoutApproval";
export const PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY = "payment.storeCreditExpiryDays";

export const PAYMENT_METHODS_DEFAULT: readonly PaymentMethod[] = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.BKASH,
  PAYMENT_METHOD.NAGAD,
  PAYMENT_METHOD.BANK,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.STORE_CREDIT,
];

export const PAYMENT_RULE_KEYS = Object.freeze({
  PAYMENT_REFERENCE_TAKEN: "errors.payment_reference_taken",
  DEPOSIT_REQUIRED: "errors.deposit_required",
  PAYMENT_ALLOCATIONS_INVALID: "errors.payment_allocations_invalid",
  PAYMENT_OVERPAYMENT_REQUIRES_CONTACT: "errors.payment_overpayment_requires_contact",
  PAYMENT_REFUND_EXCEEDS_PAID: "errors.payment_refund_exceeds_paid",
  PAYMENT_REVERSAL_ALREADY_REVERSED: "errors.payment_reversal_already_reversed",
  STORE_CREDIT_INSUFFICIENT: "errors.store_credit_insufficient",
  PAYMENT_METHOD_NOT_ALLOWED: "errors.payment_method_not_allowed",
  PAYMENT_REQUEST_NOT_FOUND: "errors.payment_request_not_found",
  PAYMENT_APPROVAL_REQUIRED: "errors.payment_approval_required",
  PAYMENT_ORIGINAL_NOT_FOUND: "errors.payment_original_not_found",
  STORE_CREDIT_CONTACT_REQUIRED: "errors.store_credit_contact_required",
} as const);

export type PaymentRuleKey = (typeof PAYMENT_RULE_KEYS)[keyof typeof PAYMENT_RULE_KEYS];

export interface PaymentAllocation {
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly enrollmentPeriodId?: string | null;
  readonly amount: Money;
}

export interface PaymentApprovalSnapshot {
  readonly approvalId: string;
  readonly approverUserId: string;
  readonly approvedAt: string;
}

export interface PaymentResponse {
  readonly paymentId: string;
  readonly paymentNumber: string;
  readonly locationId: string;
  readonly direction: PaymentDirection;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference?: string | null;
  readonly reversesPaymentId?: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null;
  readonly receivedByMemberId: string;
  readonly businessDate: string;
  readonly approval?: PaymentApprovalSnapshot | null;
  readonly note?: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoreCreditEntryResponse {
  readonly storeCreditEntryId: string;
  readonly contactId: string;
  readonly direction: StoreCreditDirection;
  readonly kind: StoreCreditEntryKind;
  readonly amount: Money;
  readonly paymentId?: string | null;
  readonly balanceAfterMinor: number;
  readonly note?: string | null;
  readonly expiresAt?: string | null;
  readonly createdAt: string;
}

export interface DueItemResponse {
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly contactId: string | null;
  readonly locationId: string | null;
  readonly total: Money;
  readonly allocated: Money;
  readonly refunded: Money;
  readonly due: Money;
  readonly paymentStatus: PaymentStatus;
}
