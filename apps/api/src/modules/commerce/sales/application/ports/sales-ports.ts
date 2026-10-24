import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type {
  OrderLineModifierSnapshot,
  OrderStatus,
  SalesAdvanceRequired,
} from "@banijjik/contracts/sales";
import type { Money } from "@banijjik/contracts/pricing";
import type {
  ContactId,
  OfferingId,
  OrderId,
  OrganizationId,
  LocationId,
  UserId,
} from "@banijjik/ids";
import type { PriceQuoter } from "../../../pricing/index.js";
import type { StockLedger } from "../../../inventory/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import type { Order } from "../../domain/order.entity.js";
import type { PaymentTotals } from "../../domain/payment-status.js";

export type SalesQuoter = Pick<PriceQuoter, "quote">;
export type SalesStockLedger = Pick<StockLedger, "reserve" | "release" | "commitSale">;
export type SalesApprovalVerifier = Pick<ApprovalVerifier, "consume">;
/** The stock-ledger input shape, taken from the port so sales never imports inventory internals. */
export type StockLedgerReserveInput = Parameters<StockLedger["reserve"]>[0];

export interface OrderListFilter {
  /** The locations the caller reaches, narrowed by the query; empty means an empty page. */
  readonly locationIds: readonly string[] | "ALL";
  readonly status?: OrderStatus;
  readonly contactIds?: readonly string[];
  readonly orderNumber?: string;
  /** `q`: an exact order number or one of the found contacts, as an `$or` of indexed branches. */
  readonly search?: { readonly orderNumber: string; readonly contactIds: readonly string[] };
  readonly from?: Date;
  readonly to?: Date;
  readonly page: number;
  readonly limit: number;
}

/** One list row as the query projects it (decision 9): the line snapshots are never loaded. */
export interface OrderListRow {
  readonly orderId: OrderId;
  readonly orderNumber: string | null;
  readonly status: OrderStatus;
  readonly contactId: ContactId | null;
  readonly grandTotal: Money;
  readonly createdAt: Date;
}

export interface OrderPage {
  readonly items: readonly OrderListRow[];
  readonly hasNext: boolean;
}

export interface OrderRepository {
  insert(order: Order): Promise<void>;
  findById(orderId: OrderId): Promise<Order | undefined>;
  /** Throws a 409 CONFLICT for a stale version. */
  update(order: Order, expectedVersion: number): Promise<Order>;
  /** The only delete: a DRAFT that never had a number (decision 4). */
  deleteDraft(orderId: OrderId, expectedVersion: number): Promise<void>;
  list(filter: OrderListFilter): Promise<OrderPage>;
  /** Jobs read their candidates across the active organization; the tenant plugin scopes them. */
  findDraftsCreatedBefore(cutoff: Date, limit: number): Promise<readonly Order[]>;
  findPlacedCreatedBefore(cutoff: Date, limit: number): Promise<readonly Order[]>;
}

/** One counter row per organization and organization-local month (decision 7). */
export interface OrderCounter {
  /** Upserts and increments; the returned value is the count after this increment. */
  increment(monthKey: string): Promise<number>;
}

export interface SalesSettings {
  readonly autoConfirm: boolean;
  readonly draftExpiryHours: number;
  readonly placedAutoCancelHours: number;
  readonly usePacking: boolean;
  readonly discountOwnerWithoutApproval: boolean;
  readonly advanceRequired: SalesAdvanceRequired;
  readonly advanceValue: number;
  /** Read from the inventory module's setting before the order transaction opens (decision 5). */
  readonly allowNegativeStock: boolean;
}

export interface SalesSettingsReader {
  read(organizationId: OrganizationId): Promise<SalesSettings>;
}

export interface SalesContact {
  readonly contactId: ContactId;
  readonly name: string | null;
  readonly phoneE164: string | null;
}

export interface SalesContactReader {
  findActive(contactId: ContactId): Promise<SalesContact | undefined>;
  findNames(contactIds: readonly ContactId[]): Promise<ReadonlyMap<string, string | null>>;
  /** The ACTIVE contacts whose name or phone starts with the term, through contact's indexes. */
  searchActiveIds(term: string): Promise<readonly ContactId[]>;
}

/** Catalog facts for one order line, snapshotted at quote time. */
export interface SalesCatalogLine {
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: OfferingKind;
  readonly nameSnapshot: string;
  readonly modifiers: readonly OrderLineModifierSnapshot[];
  readonly stockComponents: readonly StockComponent[];
  readonly taxClassKey: string | null;
}
export interface SalesCatalogLineRequest {
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
}

export interface SalesCatalogReader {
  readLines(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly SalesCatalogLineRequest[];
  }): Promise<readonly SalesCatalogLine[]>;
}

/** The inventory average cost of one sales unit per ordered variant (ADR-125). */
export interface SalesUnitCostReader {
  read(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly {
      readonly offeringId: string;
      readonly variantId: string;
      readonly stockComponents: readonly StockComponent[];
    }[];
  }): Promise<ReadonlyMap<string, Money | null>>;
}

export interface SalesTimeZoneReader {
  read(organizationId: OrganizationId): Promise<string>;
}

/** The organization currency, for the zero delivery charge and the totals of an empty draft. */
export interface SalesCurrencyReader {
  read(organizationId: OrganizationId): Promise<CurrencyCode>;
}

export interface SalesOwnerReader {
  /** Whether the caller holds the OWNER system role in the active organization. */
  isOwner(): Promise<boolean>;
}

export interface OrderPaymentPort {
  initializeSummary(input: {
    organizationId: OrganizationId;
    orderId: OrderId;
    contactId: ContactId | null;
    locationId: LocationId;
    total: Money;
    now: Date;
  }): Promise<void>;
  updateTotal(input: {
    organizationId: OrganizationId;
    orderId: OrderId;
    total: Money;
    now: Date;
  }): Promise<void>;
  readTotals(orderId: OrderId): Promise<PaymentTotals>;
  readTotalsMany(orderIds: readonly OrderId[]): Promise<ReadonlyMap<OrderId, PaymentTotals>>;
  readNetPaid(input: { organizationId: OrganizationId; orderId: OrderId }): Promise<Money>;
  settleCancellation(input: {
    organizationId: OrganizationId;
    orderId: OrderId;
    contactId: ContactId | null;
    locationId: LocationId;
    actorUserId: UserId | null;
    now: Date;
  }): Promise<void>;
}

export interface SalesUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface OrderEventPublisher {
  publish(
    type: string,
    payload: { readonly orderId: string },
    options: { readonly orderingKey: string },
  ): Promise<void>;
}
