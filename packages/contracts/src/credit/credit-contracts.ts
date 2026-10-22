import type { Money } from "../accounting/accounting-contracts.js";

export const CREDIT_PACK_NAME_MAX_LENGTH = 100;
export const CREDIT_ADJUST_REASON_MAX_LENGTH = 500;

export const CREDIT_PACK_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type CreditPackStatus = (typeof CREDIT_PACK_STATUS)[keyof typeof CREDIT_PACK_STATUS];

export const CREDIT_ENTRY_TYPE = {
  PURCHASE: "PURCHASE",
  SPEND: "SPEND",
  REFUND: "REFUND",
  EXPIRE: "EXPIRE",
  ADJUST: "ADJUST",
} as const;
export type CreditEntryType = (typeof CREDIT_ENTRY_TYPE)[keyof typeof CREDIT_ENTRY_TYPE];

export const CREDIT_SOURCE_TYPE = {
  PAYMENT: "PAYMENT",
  PURCHASE: "PURCHASE",
  UNLOCK: "UNLOCK",
  ADJUSTMENT: "ADJUSTMENT",
  EXPIRY_JOB: "EXPIRY_JOB",
} as const;
export type CreditSourceType = (typeof CREDIT_SOURCE_TYPE)[keyof typeof CREDIT_SOURCE_TYPE];

export const CREDIT_PURCHASE_STATUS = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type CreditPurchaseStatus =
  (typeof CREDIT_PURCHASE_STATUS)[keyof typeof CREDIT_PURCHASE_STATUS];

export const CREDIT_PURCHASE_METHOD = {
  BKASH: "BKASH",
  NAGAD: "NAGAD",
} as const;
export type CreditPurchaseMethod =
  (typeof CREDIT_PURCHASE_METHOD)[keyof typeof CREDIT_PURCHASE_METHOD];

export const CREDIT_API_MESSAGE_KEYS = {
  creditsInsufficient: "errors.credit_credits_insufficient",
  packNotFound: "errors.credit_pack_not_found",
  accountNotFound: "errors.credit_account_not_found",
  cannotUnlockOwnListing: "errors.credit_cannot_unlock_own_listing",
  unlocksPerDayExceeded: "errors.credit_unlocks_per_day_exceeded",
  listingNotApproved: "errors.credit_listing_not_approved",
  listingNotFound: "errors.credit_listing_not_found",
  adjustReasonRequired: "errors.credit_adjust_reason_required",
  packCurrencyMismatch: "errors.credit_pack_currency_mismatch",
  adjustmentWouldGoNegative: "errors.credit_adjustment_would_go_negative",
  referenceTaken: "errors.credit_reference_taken",
  selfVerifyForbidden: "errors.credit_self_verify_forbidden",
  purchaseNotFound: "errors.credit_purchase_not_found",
  purchaseNotPending: "errors.credit_purchase_not_pending",
  maxPendingExceeded: "errors.credit_max_pending_exceeded",
  paymentMethodNotConfigured: "errors.credit_payment_method_not_configured",
  packNotActive: "errors.credit_pack_not_active",
} as const;

export const CREDIT_API_MESSAGE_KEY_LIST: readonly string[] =
  Object.values(CREDIT_API_MESSAGE_KEYS);

export interface CreditPack {
  readonly creditPackId: string;
  readonly name: { readonly bn: string; readonly en: string };
  readonly credits: number;
  readonly price: Money;
  readonly validityDays: number | null;
  readonly status: CreditPackStatus;
  readonly sortOrder: number;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreditEntry {
  readonly creditEntryId: string;
  readonly customerAccountId: string;
  readonly type: CreditEntryType;
  readonly credits: number;
  readonly expiresOn: string | null;
  readonly source: {
    readonly sourceType: CreditSourceType;
    readonly sourceId: string;
  };
  readonly fromPurchaseEntryId: string | null;
  readonly reason: string | null;
  readonly createdByUserId: string | null;
  readonly occurredAt: string;
  readonly businessDate: string;
  readonly createdAt: string;
}

export interface CreditBalance {
  readonly customerAccountId: string;
  readonly balance: number;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ListingUnlock {
  readonly listingUnlockId: string;
  readonly customerAccountId: string;
  readonly listingId: string;
  readonly creditEntryId: string;
  readonly unlockedAt: string;
  readonly createdAt: string;
}

export interface CreditPackCreateRequest {
  readonly name: { readonly bn: string; readonly en: string };
  readonly credits: number;
  readonly price: Money;
  readonly validityDays: number | null;
  readonly sortOrder: number;
}

export interface CreditPackUpdateRequest {
  readonly name: { readonly bn: string; readonly en: string };
  readonly credits: number;
  readonly price: Money;
  readonly validityDays: number | null;
  readonly sortOrder: number;
  readonly version: number;
}

export interface CreditAdjustRequest {
  readonly credits: number;
  readonly reason: string;
}

export interface CreditAccountResponse {
  readonly customerAccountId: string;
  readonly balance: number;
  readonly entries: readonly CreditEntry[];
}

export interface MyCreditsResponse {
  readonly balance: number;
  readonly entries: readonly CreditEntry[];
}

export interface UnlockRequest {
  readonly idempotencyKey: string;
}

export interface UnlockResponse {
  readonly listingUnlockId: string;
  readonly listingId: string;
  readonly unlockedAt: string;
  readonly creditsSpent: number;
  readonly remainingBalance: number;
}

export interface UnlockListItem {
  readonly listingUnlockId: string;
  readonly listingId: string;
  readonly listingNumber: string;
  readonly unlockedAt: string;
  readonly customFields: Record<string, unknown>;
}

/** Count only: the listing owner never learns who unlocked (M.4 decision 6). */
export interface ListingUnlockCountResponse {
  readonly listingId: string;
  readonly unlockCount: number;
}

export interface CreditEntryCreatedPayload {
  readonly creditEntryId: string;
  readonly customerAccountId: string;
  readonly type: CreditEntryType;
  readonly credits: number;
  readonly source: {
    readonly sourceType: CreditSourceType;
    readonly sourceId: string;
  };
  readonly occurredAt: string;
}

export interface UnlockCreatedPayload {
  readonly listingUnlockId: string;
  readonly customerAccountId: string;
  readonly listingId: string;
  readonly creditEntryId: string;
  readonly unlockedAt: string;
}

export interface CreditPurchaseSnapshot {
  readonly name: { readonly bn: string; readonly en: string };
  readonly credits: number;
  readonly price: Money;
  readonly validityDays?: number | null;
}

export interface CreditPurchase {
  readonly creditPurchaseId: string;
  readonly organizationId: string;
  readonly purchaseNumber: string;
  readonly customerAccountId: string;
  readonly creditPackId: string;
  readonly snapshot: CreditPurchaseSnapshot;
  readonly method: CreditPurchaseMethod;
  readonly senderPhoneE164: string;
  readonly transactionReference: string;
  readonly status: CreditPurchaseStatus;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: string | null;
  readonly rejectionReason: string | null;
  readonly creditEntryId: string | null;
  readonly submittedAt: string;
  readonly expiresAt: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreditPaymentMethodSetting {
  readonly method: CreditPurchaseMethod;
  readonly accountNumber: string;
  readonly accountType: string;
  readonly instructions: { readonly bn: string; readonly en: string };
}

export interface CreditPurchaseSubmitRequest {
  readonly creditPackId: string;
  readonly method: CreditPurchaseMethod;
  readonly senderPhone: string;
  readonly transactionReference: string;
}

export interface CreditPurchaseVerifyRequest {
  readonly version: number;
  readonly approvalToken?: string;
}

export interface CreditPurchaseRejectRequest {
  readonly version: number;
  readonly reason: string;
}

export interface CreditPaymentInfoResponse {
  readonly methods: readonly CreditPaymentMethodSetting[];
}

export interface CreditPurchaseResponse {
  readonly creditPurchaseId: string;
  readonly purchaseNumber: string;
  readonly customerAccountId: string;
  readonly creditPackId: string;
  readonly snapshot: CreditPurchaseSnapshot;
  readonly method: CreditPurchaseMethod;
  readonly senderPhoneE164: string;
  readonly transactionReference: string;
  readonly status: CreditPurchaseStatus;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: string | null;
  readonly rejectionReason: string | null;
  readonly creditEntryId: string | null;
  readonly submittedAt: string;
  readonly expiresAt: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreditPurchaseVerifiedPayload {
  readonly creditPurchaseId: string;
  readonly purchaseNumber: string;
  readonly customerAccountId: string;
  readonly creditPackId: string;
  readonly method: CreditPurchaseMethod;
  readonly transactionReference: string;
  readonly credits: number;
  readonly creditEntryId: string;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: string;
}

export interface CreditPurchaseEventPayload {
  readonly creditPurchaseId: string;
}
