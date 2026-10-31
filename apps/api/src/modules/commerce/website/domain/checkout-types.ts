import type { Money } from "@banijjik/contracts/pricing";
import type {
  CheckoutFulfillment,
  CheckoutSelection,
  PublicQuoteLine,
} from "@banijjik/contracts/website";

export interface CheckoutQuoteInputSnapshot {
  readonly locationId: string;
  readonly selections: readonly CheckoutSelection[];
  readonly fulfillment: CheckoutFulfillment;
}

export interface CheckoutPricedSnapshot {
  readonly total: Money;
  readonly lines: readonly PublicQuoteLine[];
  readonly deliveryCharge: Money;
}

export interface CheckoutQuote {
  readonly quoteId: string;
  readonly organizationId: string;
  readonly principalKey: string;
  readonly input: CheckoutQuoteInputSnapshot;
  readonly inputHash: string;
  readonly pricedSnapshot: CheckoutPricedSnapshot;
  readonly configVersion: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly consumedCheckoutId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CheckoutContactSnapshot {
  readonly name: string;
  readonly phoneE164: string;
  readonly customFields: Readonly<Record<string, unknown>>;
}

export interface Checkout {
  readonly checkoutId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly creationPrincipalKey: string;
  readonly contactId: string;
  readonly contactSnapshot: CheckoutContactSnapshot;
  readonly quoteId: string;
  readonly acceptedTotals: {
    readonly total: Money;
    readonly deliveryCharge: Money;
  };
  readonly idempotencyKeyHash: string;
  readonly inputHash: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CheckoutAccessOwner =
  | { readonly type: "CUSTOMER"; readonly identifier: string }
  | { readonly type: "GUEST"; readonly identifier: string };

export interface CheckoutAccess {
  readonly checkoutAccessId: string;
  readonly organizationId: string;
  readonly checkoutId: string;
  readonly owner: CheckoutAccessOwner;
  readonly revokedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CheckoutRequestLinkRecord {
  readonly checkoutRequestLinkId: string;
  readonly organizationId: string;
  readonly checkoutId: string;
  readonly selectionIds: readonly string[];
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly requestId: string;
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: Date | null;
  // Owner projection of CheckoutAccess, denormalized so tracking lists page in the database
  // without a $lookup (the tenant kernel refuses joins, ADR-087).
  readonly ownerType: "CUSTOMER" | "GUEST";
  readonly ownerIdentifier: string;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
