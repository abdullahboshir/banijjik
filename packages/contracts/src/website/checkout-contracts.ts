import type { Money } from "../pricing/pricing-contracts.js";
import type { CheckoutContactSnapshot } from "../contact/guest-contact-contracts.js";

export type CheckoutOfferingKind = "PRODUCT" | "SERVICE" | "RENTAL" | "EVENT" | "PLAN";

export interface StorefrontCommandContext {
  readonly organizationId: string;
  readonly locationId: string;
  readonly contactId: string;
  readonly checkoutId: string;
  readonly actorUserId: null;
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
}

export type PublicSelection =
  | {
      readonly kind: "PRODUCT";
      readonly offeringId: string;
      readonly variantId: string;
      readonly quantity: number;
      readonly modifierOptionIds: readonly string[];
    }
  | {
      readonly kind: "SERVICE";
      readonly offeringId: string;
      readonly variantId: string;
      readonly startsAt: string; // ISO 8601
      readonly resourceIds: readonly string[];
    }
  | {
      readonly kind: "RENTAL";
      readonly offeringId: string;
      readonly variantId: string;
      readonly startsAt: string; // ISO 8601
      readonly endsAt: string; // ISO 8601
      readonly resourceIds: readonly string[];
    }
  | {
      readonly kind: "EVENT";
      readonly offeringId: string;
      readonly variantId: string;
      readonly eventSessionId: string;
      readonly quantity: number;
    }
  | {
      readonly kind: "PLAN";
      readonly offeringId: string;
      readonly variantId: string;
      readonly startsOn: string; // YYYY-MM-DD
      readonly resourceIds: readonly string[];
    };

export type CheckoutSelectionItem = PublicSelection;

export interface CheckoutSelection {
  readonly selectionId: string;
  readonly selection: PublicSelection;
  readonly customFields: Readonly<Record<string, unknown>>;
}

export interface CheckoutRecipientSnapshot {
  readonly name: string;
  readonly phoneE164: string;
}

export type CheckoutFulfillmentMethod = "PICKUP" | "COURIER" | "OWN_RIDER";
export type CheckoutFulfillmentKind =
  "PICKUP" | "DELIVERY" | "ON_PREMISE" | "DIGITAL" | CheckoutFulfillmentMethod;

export interface CheckoutFulfillmentAddress {
  readonly recipientName: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly districtCode: string;
  readonly areaCode: string;
  readonly postalCode?: string;
}

export interface CheckoutFulfillment {
  readonly method: CheckoutFulfillmentMethod;
  readonly address?: CheckoutFulfillmentAddress;
  readonly kind?: CheckoutFulfillmentKind;
  readonly notes?: string;
}

export interface CheckoutRequestLink {
  readonly selectionIds: readonly string[];
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly requestId: string;
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: string | null;
  readonly payableAmount?: Money;
}

export interface PublicOrderCommands {
  place(
    context: StorefrontCommandContext,
    input: {
      readonly selections: readonly CheckoutSelection[];
      readonly recipient: CheckoutRecipientSnapshot;
      readonly fulfillment: CheckoutFulfillment;
      readonly notes?: string;
    },
  ): Promise<CheckoutRequestLink>;
}

export interface PublicBookingCommands {
  request(
    context: StorefrontCommandContext,
    input: CheckoutSelection,
  ): Promise<CheckoutRequestLink>;
}

export interface PublicEnrollmentCommands {
  request(
    context: StorefrontCommandContext,
    input: CheckoutSelection,
  ): Promise<CheckoutRequestLink>;
}

export interface PublicQuoteRequest {
  readonly locationId: string;
  readonly selections: readonly CheckoutSelection[];
  readonly fulfillment: CheckoutFulfillment;
}

export interface PublicQuoteLineResponse {
  readonly selectionId: string;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly amountRequiredBeforeConfirmation: Money;
}

export type PublicQuoteLine = PublicQuoteLineResponse;

export interface PublicQuoteResponse {
  readonly quoteId: string;
  readonly expiresAt: string;
  readonly total: Money;
  readonly lines: readonly PublicQuoteLineResponse[];
  readonly deliveryCharge: Money;
}

export interface CheckoutContactInput {
  readonly name: string;
  readonly phone: string;
  readonly customFields?: Readonly<Record<string, unknown>>;
}

export interface CheckoutRequest {
  readonly quoteId: string;
  readonly contact: CheckoutContactInput;
}

export interface CheckoutResponse {
  readonly checkoutId: string;
  readonly locationId: string;
  readonly total: Money;
  readonly requests: readonly CheckoutRequestLink[];
}

export type CheckoutPrincipal =
  | { readonly type: "CUSTOMER"; readonly customerAccountId: string; readonly contactId: string }
  | { readonly type: "GUEST"; readonly guestSessionId: string };

export const WEBSITE_CHECKOUT_ENABLED_SETTING_KEY = "website.checkoutEnabled";
export const WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY = "website.publicLocationIds";
/**
 * Flat delivery fee in the organization currency's minor units (card 4.3 A5A). COD part S1
 * replaces it with a DeliveryZone fee quoted by destination.
 */
export const WEBSITE_DELIVERY_CHARGE_SETTING_KEY = "website.deliveryCharge";

export const STOREFRONT_CHECKOUT_PER_WINDOW = 10;
export const STOREFRONT_CHECKOUT_WINDOW_SECONDS = 600;
export const STOREFRONT_CHECKOUT_RATE_LIMIT_BUCKET = "storefront.checkout.session";

export const CHECKOUT_RULE_KEY = Object.freeze({
  QUOTE_EXPIRED: "errors.checkout_quote_expired",
  PRICE_CHANGED: "errors.checkout_price_changed",
  LOCATION_MISMATCH: "errors.checkout_location_mismatch",
  NOT_AVAILABLE: "errors.checkout_not_available",
  CAPACITY_UNAVAILABLE: "errors.checkout_capacity_unavailable",
  DISABLED: "errors.checkout_disabled",
  READ_ONLY: "errors.org_read_only",
  REPLAY_FORBIDDEN: "errors.forbidden",
  CLAIM_PHONE_MISMATCH: "errors.checkout_claim_phone_mismatch",
} as const);

export interface CheckoutDetailRequestItem {
  readonly requestId: string;
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly payableAmount?: Money;
  readonly holdExpiresAt: string | null;
}

export interface CheckoutDetailResponse {
  readonly checkoutId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly status: string;
  readonly requests: readonly CheckoutDetailRequestItem[];
  readonly contactSnapshot: CheckoutContactSnapshot;
  readonly acceptedTotals: Money;
  readonly total: Money;
  readonly deliveryCharge: Money;
  readonly createdAt: string;
  readonly ownerType: "CUSTOMER" | "GUEST";
  readonly canClaim: boolean;
}

export interface ClaimCheckoutResponse {
  readonly success: boolean;
  readonly checkoutId: string;
  readonly customerAccountId?: string;
  readonly claimedAt?: string;
}

export interface StorefrontRequestListQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly requestType?: "ORDER" | "BOOKING" | "ENROLLMENT";
}

export interface StorefrontRequestItem {
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly requestId: string;
  readonly checkoutId?: string;
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: string | null;
  readonly createdAt: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface StorefrontRequestListResponse {
  readonly items: readonly StorefrontRequestItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export type StorefrontOrderFulfillmentMethod = "INSTANT" | "PICKUP" | "COURIER" | "OWN_RIDER";

/** The order line fields a guest may see: no seller, cost, discount or promotion metadata. */
export interface StorefrontOrderItem {
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface StorefrontRequestSchedule {
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface StorefrontRequestPlan {
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface StorefrontRequestFulfillment {
  readonly method: StorefrontOrderFulfillmentMethod;
}

export interface StorefrontRequestDetailResponse extends StorefrontRequestItem {
  readonly organizationId: string;
  readonly locationId?: string;
  readonly items?: readonly StorefrontOrderItem[];
  readonly schedule?: StorefrontRequestSchedule;
  readonly plan?: StorefrontRequestPlan;
  readonly fulfillment?: StorefrontRequestFulfillment;
}
