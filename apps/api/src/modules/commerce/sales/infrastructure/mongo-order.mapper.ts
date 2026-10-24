import { ORDER_RETURN_STATUS } from "@banijjik/contracts/sales";
import {
  asId,
  type ContactId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { CurrencyCode } from "@banijjik/contracts";
import type {
  Money,
  OrderApproval,
  OrderLineModifierSnapshot,
  OrderTotals,
} from "@banijjik/contracts/sales";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import { Order } from "../domain/order.entity.js";
import type { OrderLineProps, OrderProps } from "../domain/order-types.js";
import type { OrderListRow } from "../application/ports/sales-ports.js";
import type {
  ApprovalDocument,
  ManualDiscountDocument,
  ModifierSnapshotDocument,
  MoneyDocument,
  OrderDocument,
  OrderLineDocument,
  TotalsDocument,
} from "./sales.schema.js";

/** Mongo stores the currency as a plain string; the writer only ever stores the org currency. */
function moneyOf(row: MoneyDocument): Money {
  return { amount: row.amount, currency: row.currency as CurrencyCode };
}

function discountOf(row: ManualDiscountDocument | null): ManualDiscount | null {
  return row === null ? null : { type: row.type, value: row.value };
}

function totalsOf(row: TotalsDocument): OrderTotals {
  return {
    subtotal: moneyOf(row.subtotal),
    discountTotal: moneyOf(row.discountTotal),
    taxTotal: moneyOf(row.taxTotal),
    deliveryCharge: moneyOf(row.deliveryCharge),
    grandTotal: moneyOf(row.grandTotal),
    roundingAdjustment: moneyOf(row.roundingAdjustment),
  };
}

function modifiersOf(
  row: readonly ModifierSnapshotDocument[],
): readonly OrderLineModifierSnapshot[] {
  return row.map((modifier) => ({
    modifierGroupId: modifier.modifierGroupId,
    modifierOptionId: modifier.modifierOptionId,
    nameSnapshot: modifier.nameSnapshot,
    priceDelta: moneyOf(modifier.priceDelta),
  }));
}

function approvalOf(row: ApprovalDocument | null): OrderApproval | null {
  if (row === null) return null;
  return { approverMemberId: row.approverMemberId, approvedAt: row.approvedAt, action: row.action };
}

function lineOf(row: OrderLineDocument): OrderLineProps {
  return {
    orderLineId: row.orderLineId,
    offeringId: row.offeringId,
    variantId: row.variantId,
    kind: row.kind,
    nameSnapshot: row.nameSnapshot,
    quantity: row.quantity,
    unitPrice: moneyOf(row.unitPrice),
    lineGross: moneyOf(row.lineGross),
    lineDiscount: moneyOf(row.lineDiscount),
    lineTax: moneyOf(row.lineTax),
    lineNetTotal: moneyOf(row.lineNetTotal),
    unitCostSnapshot: row.unitCostSnapshot === null ? null : moneyOf(row.unitCostSnapshot),
    modifiers: modifiersOf(row.modifiers),
    returnedQuantity: row.returnedQuantity,
    promotionIds: [...row.promotionIds],
    taxClassKey: row.taxClassKey,
    costComponents: [...row.costComponents] as readonly StockComponent[],
    manualDiscount: discountOf(row.manualDiscount),
    performedByMemberId: row.performedByMemberId ?? null,
  };
}

export function toOrder(row: OrderDocument): Order {
  return Order.restore({
    orderId: asId<OrderId>(row.orderId),
    organizationId: asId<OrganizationId>(row.organizationId),
    orderNumber: row.orderNumber,
    invoiceNumber: row.invoiceNumber,
    locationId: asId<LocationId>(row.locationId),
    contactId: row.contactId === null ? null : asId<ContactId>(row.contactId),
    status: row.status,
    lines: row.lines.map(lineOf),
    totals: totalsOf(row.totals),
    fulfillment: { method: row.fulfillment.method },
    businessDate: row.businessDate,
    source: row.source,
    approval: approvalOf(row.approval),
    note: row.note,
    orderDiscount: discountOf(row.orderDiscount),
    cancelReason: row.cancelReason,
    customFields: row.customFields,
    hasStockLines: row.hasStockLines,
    returnStatus: row.returnStatus ?? ORDER_RETURN_STATUS.NONE,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function lineDocument(line: OrderLineProps): OrderDocument["lines"][number] {
  return {
    orderLineId: line.orderLineId,
    offeringId: line.offeringId,
    variantId: line.variantId,
    kind: line.kind,
    nameSnapshot: line.nameSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineGross: line.lineGross,
    lineDiscount: line.lineDiscount,
    lineTax: line.lineTax,
    lineNetTotal: line.lineNetTotal,
    unitCostSnapshot: line.unitCostSnapshot,
    modifiers: [...line.modifiers],
    returnedQuantity: line.returnedQuantity,
    promotionIds: [...line.promotionIds],
    taxClassKey: line.taxClassKey,
    costComponents: [...line.costComponents],
    manualDiscount: line.manualDiscount,
    performedByMemberId: line.performedByMemberId,
  };
}

/**
 * What a write may rewrite. The order, organization and location ids never move, and
 * `version` is left out because `updateVersioned()` is the only writer of it.
 */
type MutableOrderFields = Omit<
  OrderDocument,
  "orderId" | "organizationId" | "locationId" | "version"
>;

function mutableFieldsOf(props: OrderProps): MutableOrderFields {
  return {
    orderNumber: props.orderNumber,
    invoiceNumber: props.invoiceNumber,
    contactId: props.contactId,
    status: props.status,
    lines: props.lines.map(lineDocument),
    totals: props.totals,
    fulfillment: { method: props.fulfillment.method },
    businessDate: props.businessDate,
    source: props.source,
    approval: props.approval,
    note: props.note,
    orderDiscount: props.orderDiscount,
    cancelReason: props.cancelReason,
    customFields: { ...props.customFields },
    hasStockLines: props.hasStockLines,
    returnStatus: props.returnStatus,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    createdByUserId: props.createdByUserId,
    updatedByUserId: props.updatedByUserId,
  };
}

/** The document an insert sends to Mongo. Branded ids are strings, so values copy one to one. */
export function orderDocument(order: Order): OrderDocument {
  const props = order.toProps();
  return {
    orderId: props.orderId,
    organizationId: props.organizationId,
    locationId: props.locationId,
    version: props.version,
    ...mutableFieldsOf(props),
  };
}

/** The `$set` payload of an update: identity fields and `version` are never rewritten. */
export function orderMutableFields(order: Order): MutableOrderFields {
  return mutableFieldsOf(order.toProps());
}

/** What the list query projects: the seven row fields, never the line snapshots (decision 9). */
export type OrderListDocument = Pick<
  OrderDocument,
  "orderId" | "orderNumber" | "status" | "contactId" | "createdAt" | "totals"
>;

export function toOrderListRow(row: OrderListDocument): OrderListRow {
  return {
    orderId: asId<OrderId>(row.orderId),
    orderNumber: row.orderNumber,
    status: row.status,
    contactId: row.contactId === null ? null : asId<ContactId>(row.contactId),
    grandTotal: moneyOf(row.totals.grandTotal),
    createdAt: row.createdAt,
  };
}
