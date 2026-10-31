import type { Money } from "../pricing/pricing-contracts.js";

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

export interface CheckoutFulfillment {
  readonly method: "PICKUP" | "COURIER" | "OWN_RIDER";
  readonly address?: {
    readonly recipientName: string;
    readonly phone: string;
    readonly addressLine: string;
    readonly districtCode: string;
    readonly areaCode: string;
    readonly postalCode?: string;
  };
  readonly kind?: "PICKUP" | "DELIVERY" | "ON_PREMISE" | "DIGITAL";
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
} as const);
