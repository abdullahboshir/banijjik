import type { Money } from "../pricing/pricing-contracts.js";

export interface StorefrontCommandContext {
  readonly organizationId: string;
  readonly locationId: string;
  readonly contactId: string;
  readonly checkoutId: string;
  readonly actorUserId: null;
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
