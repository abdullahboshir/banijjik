import type { OfferingKind } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import type {
  Money,
  OrderApproval,
  OrderFulfillment,
  OrderLineModifierSnapshot,
  OrderSource,
  OrderStatus,
  OrderTotals,
} from "@banijjik/contracts/sales";
import type { ContactId, LocationId, OrderId, OrganizationId, UserId } from "@banijjik/ids";

/**
 * A stored line. `manualDiscount` is kept outside the response snapshot so an edit can re-quote
 * exactly what the seller entered; the client never sends money, only this input.
 */
export interface OrderLineProps {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: OfferingKind;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineGross: Money;
  readonly lineDiscount: Money;
  readonly lineTax: Money;
  readonly lineNetTotal: Money;
  readonly unitCostSnapshot: Money | null;
  readonly modifiers: readonly OrderLineModifierSnapshot[];
  readonly returnedQuantity: number;
  readonly promotionIds: readonly string[];
  readonly taxClassKey: string | null;
  readonly manualDiscount: ManualDiscount | null;
}

export interface OrderProps {
  readonly orderId: OrderId;
  readonly organizationId: OrganizationId;
  readonly orderNumber: string | null;
  readonly invoiceNumber: string | null;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderTotals;
  readonly fulfillment: OrderFulfillment;
  readonly businessDate: string;
  readonly source: OrderSource;
  readonly approval: OrderApproval | null;
  readonly note: string | null;
  readonly orderDiscount: ManualDiscount | null;
  readonly cancelReason: string | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  /**
   * Whether the order holds a stock reservation (tracked lines were reserved at place). Complete
   * and cancel need it because the stock port cannot answer "is there a reservation?".
   */
  readonly hasStockLines: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewOrderInput {
  readonly orderId: OrderId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly fulfillment: OrderFulfillment;
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderTotals;
  readonly businessDate: string;
  readonly source: OrderSource;
  readonly note: string | null;
  readonly orderDiscount: ManualDiscount | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly hasStockLines: boolean;
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

export interface OrderContentChanges {
  readonly contactId?: ContactId | null;
  readonly lines?: readonly OrderLineProps[];
  readonly totals?: OrderTotals;
  readonly orderDiscount?: ManualDiscount | null;
  readonly note?: string | null;
  readonly customFields?: Readonly<Record<string, unknown>>;
  readonly hasStockLines?: boolean;
}

export interface OrderTransitionActor {
  readonly actorUserId: UserId | null;
  readonly now: Date;
}
