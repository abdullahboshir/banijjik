import type { Money } from "../catalog/catalog-contracts.js";
import type { CheckoutContactSnapshot } from "../contact/guest-contact-contracts.js";

export type CheckoutOfferingKind = "PRODUCT" | "SERVICE" | "RENTAL" | "EVENT" | "PLAN";

export interface CheckoutSelectionItem {
  readonly kind: CheckoutOfferingKind;
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds?: readonly string[];
  readonly scheduleSlotId?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
}

export interface CheckoutSelection {
  readonly selectionId: string;
  readonly selection: CheckoutSelectionItem;
  readonly customFields?: Readonly<Record<string, unknown>>;
}

export type PublicSelection = CheckoutSelectionItem;
export type CheckoutRecipientSnapshot = CheckoutContactSnapshot;

export type CheckoutFulfillmentKind = "PICKUP" | "DELIVERY" | "ON_PREMISE" | "DIGITAL";

export interface CheckoutFulfillment {
  readonly kind: CheckoutFulfillmentKind;
  readonly address?: string;
  readonly notes?: string;
}

export interface CheckoutRequestLink {
  readonly requestId: string;
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly payableAmount: Money;
  readonly status: string;
}

export interface StorefrontCommandContext {
  readonly organizationId: string;
  readonly locationId: string;
  readonly contactId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface PublicOrderCommands {
  place(
    context: StorefrontCommandContext,
    input: {
      readonly selections: readonly CheckoutSelection[];
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

export interface PublicQuoteLine {
  readonly selectionId: string;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly amountRequiredBeforeConfirmation: Money;
}

export type PublicQuoteLineResponse = PublicQuoteLine;

export interface PublicQuoteResponse {
  readonly quoteId: string;
  readonly expiresAt: string;
  readonly total: Money;
  readonly lines: readonly PublicQuoteLine[];
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
