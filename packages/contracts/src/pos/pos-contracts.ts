import { defineEnum } from "../define-enum.js";
import { PAYMENT_METHOD } from "../payment/payment-contracts.js";
import type { Money, PaymentMethod } from "../payment/payment-contracts.js";
import type { ManualDiscount } from "../pricing/pricing-contracts.js";
import type { OrderResponse } from "../sales/sales-contracts.js";

export const POS_DEVICE_STATUS = defineEnum(["ACTIVE", "REVOKED"]);
export type PosDeviceStatus = (typeof POS_DEVICE_STATUS)[keyof typeof POS_DEVICE_STATUS];

export const POS_SESSION_STATUS = defineEnum(["OPEN", "CLOSED"]);
export type PosSessionStatus = (typeof POS_SESSION_STATUS)[keyof typeof POS_SESSION_STATUS];

/** The one-time pairing code and its limits (plan 3.9 decision 2). */
export const POS_PAIRING_RULES = Object.freeze({
  codeLength: 8,
  ttlMinutes: 10,
  attemptsPerMemberPerHour: 10,
});

/** The httpOnly cookie that binds a browser to its device. Its value is a random secret, never an id. */
export const POS_DEVICE_COOKIE_NAME = "pos_device";
export const POS_DEVICE_COOKIE_PATH = "/api/v1";
export const POS_DEVICE_COOKIE_MAX_AGE_DAYS = 365;

/** The methods a till takes. Store credit has its own field, because it is spent first. */
export const POS_SALE_PAYMENT_METHODS: readonly PaymentMethod[] = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.BKASH,
  PAYMENT_METHOD.NAGAD,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.BANK,
];

export const POS_MAX_SALE_PAYMENTS = 5;
export const POS_DEVICE_NAME_MAX_LENGTH = 80;
export const POS_SESSION_NOTE_MAX_LENGTH = 200;
export const POS_HELD_CART_MAX_PER_DEVICE = 20;
export const POS_HELD_CART_TTL_HOURS = 24;
export const POS_HELD_CART_LABEL_MAX_LENGTH = 40;
export const POS_MAX_COLLECTION_ALLOCATIONS = 10;
export const POS_SESSION_LIST_DEFAULT_LIMIT = 20;
export const POS_SESSION_LIST_MAX_LIMIT = 100;

/** Compact rows for a local cache, so this page may be larger than the usual 100 (plan decision 8). */
export const POS_CATALOG_SNAPSHOT_MAX_LIMIT = 500;
export const POS_CATALOG_SNAPSHOT_DEFAULT_LIMIT = 200;

export const POS_REQUIRE_SHIFT_SETTING_KEY = "pos.requireShift";
export const POS_ALLOW_CREDIT_SALE_SETTING_KEY = "pos.allowCreditSale";
export const POS_RECEIPT_FOOTER_SETTING_KEY = "pos.receiptFooter";

export const POS_REQUIRE_SHIFT_DEFAULT = true;
export const POS_ALLOW_CREDIT_SALE_DEFAULT = false;
export const POS_RECEIPT_FOOTER_DEFAULT = "";
export const POS_RECEIPT_FOOTER_MAX_LENGTH = 200;

/** Business-rule keys of the POS module (422 `details.ruleKey`). */
export const POS_RULE_KEY = {
  PAYMENT_SHORT: "POS_PAYMENT_SHORT",
  OVERPAYMENT_NOT_CASH: "POS_OVERPAYMENT_NOT_CASH",
  CASH_TENDERED_INVALID: "POS_CASH_TENDERED_INVALID",
  TENDER_REQUIRED: "POS_TENDER_REQUIRED",
  CURRENCY_MISMATCH: "POS_CURRENCY_MISMATCH",
  HELD_CART_LIMIT: "POS_HELD_CART_LIMIT",
  COLLECTION_MISMATCH: "POS_COLLECTION_MISMATCH",
  COLLECTION_MIXED_CONTACTS: "POS_COLLECTION_MIXED_CONTACTS",
} as const;

export type PosRuleKey = (typeof POS_RULE_KEY)[keyof typeof POS_RULE_KEY];

export const POS_API_MESSAGE_KEYS = {
  pairingInvalid: "errors.pos_pairing_invalid",
  deviceRequired: "errors.pos_device_required",
  sessionAlreadyOpen: "errors.pos_session_already_open",
  sessionRequired: "errors.pos_session_required",
  sessionClosed: "errors.pos_session_closed",
  paymentShort: "errors.pos_payment_short",
  overpaymentNotCash: "errors.pos_overpayment_not_cash",
  cashTenderedInvalid: "errors.pos_cash_tendered_invalid",
  tenderRequired: "errors.pos_tender_required",
  currencyMismatch: "errors.pos_currency_mismatch",
  heldCartLimit: "errors.pos_held_cart_limit",
  collectionMismatch: "errors.pos_collection_mismatch",
  collectionMixedContacts: "errors.pos_collection_mixed_contacts",
} as const;

export const POS_API_MESSAGE_KEY_LIST: readonly string[] = Object.values(POS_API_MESSAGE_KEYS);

export interface PosDeviceResponse {
  readonly posDeviceId: string;
  readonly locationId: string;
  readonly name: string;
  readonly status: PosDeviceStatus;
  readonly pairedAt: string | null;
  readonly lastSeenAt: string | null;
  /** True while a pairing code is waiting to be used. The code itself is never readable again. */
  readonly isAwaitingPairing: boolean;
  readonly version: number;
  readonly createdAt: string;
}

/** The only answer that carries the code: shown once, 10 minutes (plan decision 2). */
export interface PosDeviceCreatedResponse extends PosDeviceResponse {
  readonly pairingCode: string;
  readonly pairingExpiresAt: string;
}

export interface PosPairResponse {
  readonly posDeviceId: string;
  readonly locationId: string;
  readonly name: string;
}

export interface PosMethodTotal {
  readonly method: PaymentMethod;
  readonly total: Money;
  readonly count: number;
}

export interface PosZReportReturns {
  readonly count: number;
  readonly value: Money;
  readonly refunds: readonly PosMethodTotal[];
}

/** The numbered Z-report, frozen when the register closes (plan decision 7). */
export interface PosZReport {
  readonly zReportNumber: string;
  readonly posSessionId: string;
  readonly posDeviceId: string;
  readonly locationId: string;
  readonly openedByMemberId: string;
  readonly openedAt: string;
  readonly closedByMemberId: string;
  readonly closedAt: string;
  readonly salesCount: number;
  readonly gross: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly grandTotal: Money;
  readonly paymentsIn: readonly PosMethodTotal[];
  readonly collections: readonly PosMethodTotal[];
  readonly refunds: readonly PosMethodTotal[];
  readonly returns: PosZReportReturns;
  readonly storeCreditUsed: Money;
  readonly duesCreated: Money;
  readonly openingFloat: Money;
  readonly expectedCash: Money;
  readonly countedCash: Money;
  readonly variance: Money;
}

export interface PosSessionResponse {
  readonly posSessionId: string;
  readonly posDeviceId: string;
  readonly locationId: string;
  readonly openedByMemberId: string;
  readonly openingFloat: Money;
  readonly status: PosSessionStatus;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly closedByMemberId: string | null;
  readonly expectedCash: Money | null;
  readonly countedCash: Money | null;
  readonly variance: Money | null;
  readonly zReportNumber: string | null;
  readonly version: number;
}

export interface PosSalePaymentResponse {
  readonly paymentId: string;
  readonly paymentNumber: string;
  readonly method: PaymentMethod;
  readonly amount: Money;
}

export interface PosSaleResponse {
  readonly order: OrderResponse;
  readonly posSessionId: string | null;
  /** Store credit first, then the payments in the order they were sent. */
  readonly payments: readonly PosSalePaymentResponse[];
  readonly storeCreditUsed: Money;
  /** What the cashier hands back. Printed, never stored as money (11 section 7.1). */
  readonly changeDue: Money;
  /** What stays owed on the order: zero unless a credit sale was allowed. */
  readonly dueAmount: Money;
  readonly receiptFooter: string;
}

export interface PosCatalogRow {
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: string;
  readonly offeringName: string;
  readonly variantName: string;
  readonly price: Money;
  readonly unitKey: string;
  readonly precision: number;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly updatedAt: string;
}

export interface PosCatalogRemovedRow {
  readonly offeringId: string;
  readonly variantId: string;
}

/** A page of the local cache. Send `nextCursor` back until it is null, then keep `serverTime` as the next `since`. */
export interface PosCatalogSnapshotResponse {
  readonly items: readonly PosCatalogRow[];
  /** With `since`: variants that changed but are no longer sellable here, so the cache can drop them. */
  readonly removed: readonly PosCatalogRemovedRow[];
  readonly nextCursor: string | null;
  readonly serverTime: string;
}

export interface PosHeldCartLine {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
  readonly manualDiscount?: ManualDiscount;
  readonly performedByMemberId?: string | null;
}

/** Held carts store no prices, payments or approval tokens: the sale re-quotes when resumed (A2-1). */
export interface PosHeldCartPayload {
  readonly contactId?: string | null;
  readonly lines: readonly PosHeldCartLine[];
  readonly orderDiscount?: ManualDiscount;
  readonly note?: string;
  readonly customFields?: Readonly<Record<string, unknown>>;
}

export interface PosHeldCartResponse {
  readonly posHeldCartId: string;
  readonly posDeviceId: string;
  readonly locationId: string;
  readonly label: string;
  readonly cart: PosHeldCartPayload;
  readonly heldByMemberId: string;
  readonly expiresAt: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface PosCollectionResponse {
  readonly posSessionId: string | null;
  readonly payments: readonly PosSalePaymentResponse[];
  readonly changeDue: Money;
}

export interface PosSessionListResponse {
  readonly items: readonly PosSessionResponse[];
  readonly nextCursor: string | null;
}

/** Active tills of the whole organization. The package limit itself is `limits.posDevices` on `/me/config`. */
export interface PosDeviceUsageResponse {
  readonly activeDeviceCount: number;
}
