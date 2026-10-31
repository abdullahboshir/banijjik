import type { EventPayloadMap } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/pricing";
import type {
  CheckoutFulfillment,
  CheckoutSelection,
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
  PublicQuoteLine,
  WebsiteEventType,
} from "@banijjik/contracts/website";
import type {
  Checkout,
  CheckoutAccess,
  CheckoutAccessOwner,
  CheckoutContactSnapshot,
  CheckoutQuote,
  CheckoutRequestLinkRecord,
} from "../domain/checkout-types.js";

export interface CheckoutQuoteRepositoryPort {
  save(quote: CheckoutQuote): Promise<void>;
  findById(organizationId: string, quoteId: string): Promise<CheckoutQuote | null>;
  markConsumed(input: {
    readonly organizationId: string;
    readonly quoteId: string;
    readonly checkoutId: string;
    readonly now: Date;
  }): Promise<boolean>;
}

export interface CheckoutRepositoryPort {
  save(checkout: Checkout): Promise<void>;
  findById(organizationId: string, checkoutId: string): Promise<Checkout | null>;
  findByQuoteId(organizationId: string, quoteId: string): Promise<Checkout | null>;
  findByIdempotencyKey(
    organizationId: string,
    creationPrincipalKey: string,
    idempotencyKeyHash: string,
  ): Promise<Checkout | null>;
}

export interface CheckoutAccessRepositoryPort {
  save(access: CheckoutAccess): Promise<void>;
  findByCheckoutId(organizationId: string, checkoutId: string): Promise<CheckoutAccess | null>;
  listByOwner(
    organizationId: string,
    ownerType: "CUSTOMER" | "GUEST",
    identifier: string,
  ): Promise<readonly CheckoutAccess[]>;
  updateOwner(input: {
    readonly organizationId: string;
    readonly checkoutId: string;
    readonly expectedVersion: number;
    readonly newOwner: CheckoutAccessOwner;
  }): Promise<boolean>;
  revoke(organizationId: string, checkoutId: string, now: Date): Promise<boolean>;
}

export interface CheckoutRequestLinkRepositoryPort {
  saveMany(links: readonly CheckoutRequestLinkRecord[]): Promise<void>;
  listByCheckoutId(
    organizationId: string,
    checkoutId: string,
  ): Promise<readonly CheckoutRequestLinkRecord[]>;
  findByRequest(
    organizationId: string,
    requestType: "ORDER" | "BOOKING" | "ENROLLMENT",
    requestId: string,
  ): Promise<CheckoutRequestLinkRecord | null>;
}

export interface EventPublisher {
  publish<Type extends WebsiteEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
    options?: { readonly orderingKey?: string },
  ): Promise<void>;
}

export interface PricedSelectionsResult {
  readonly lines: readonly PublicQuoteLine[];
  readonly total: Money;
  readonly deliveryCharge: Money;
  readonly configVersion: number;
}

export interface CatalogQuoteReaderPort {
  priceSelections(input: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly selections: readonly CheckoutSelection[];
    readonly fulfillment: CheckoutFulfillment;
  }): Promise<PricedSelectionsResult>;
}

export interface GuestContactPort {
  ensureProvisionalContact(input: {
    readonly organizationId: string;
    readonly guestSessionId: string;
    readonly contactSnapshot: CheckoutContactSnapshot;
  }): Promise<string>;
}

export interface StorefrontOrganizationConfig {
  readonly checkoutEnabled: boolean;
  readonly isReadOnly: boolean;
  readonly isSuspended: boolean;
  readonly publicLocationIds: readonly string[];
  readonly configVersion: number;
}

export interface OrgStorefrontConfigReader {
  readStorefrontConfig(organizationId: string): Promise<StorefrontOrganizationConfig>;
}

export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export { type PublicOrderCommands, type PublicBookingCommands, type PublicEnrollmentCommands };
