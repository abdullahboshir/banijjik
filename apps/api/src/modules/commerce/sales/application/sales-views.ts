import {
  FULFILLMENT_METHOD,
  type OrderListItem,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type {
  FirstShipmentPostingFacts,
  FirstShipmentResponse,
  OrderDeliveryResponse,
} from "@banijjik/contracts/sales/delivery";
import type { Order } from "../domain/order.entity.js";
import { derivePaymentStatus, type PaymentTotals } from "../domain/payment-status.js";
import type { OrderLineProps, OrderProps } from "../domain/order-types.js";
import type { OrderListRow } from "./ports/sales-ports.js";

function toLineSnapshot(line: OrderLineProps): OrderResponse["lines"][number] {
  return {
    orderLineId: line.orderLineId,
    offeringId: line.offeringId,
    variantId: line.variantId,
    kind: line.kind,
    nameSnapshot: line.nameSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    listUnitPrice: line.listUnitPrice,
    unitPriceOverride: line.unitPriceOverride,
    lineGross: line.lineGross,
    lineDiscount: line.lineDiscount,
    lineTax: line.lineTax,
    lineNetTotal: line.lineNetTotal,
    unitCostSnapshot: line.unitCostSnapshot,
    modifiers: line.modifiers,
    returnedQuantity: line.returnedQuantity,
    promotionIds: [...line.promotionIds],
    taxClassKey: line.taxClassKey,
    manualDiscount: line.manualDiscount ?? null,
    performedByMemberId: line.performedByMemberId,
  };
}

/** `paymentStatus` is derived from the payment totals here, never passed in (decision 8). */
export function toOrderResponse(order: Order, paymentTotals: PaymentTotals): OrderResponse {
  const props: OrderProps = order.toProps();
  return {
    orderId: props.orderId,
    orderNumber: props.orderNumber,
    invoiceNumber: props.invoiceNumber,
    locationId: props.locationId,
    contactId: props.contactId,
    status: props.status,
    lines: props.lines.map(toLineSnapshot),
    totals: props.totals,
    fulfillment: props.fulfillment,
    paymentStatus: derivePaymentStatus(props.totals.grandTotal, paymentTotals),
    returnStatus: props.returnStatus,
    businessDate: props.businessDate,
    source: props.source,
    posSessionId: props.posSessionId,
    approval: props.approval,
    note: props.note,
    orderDiscount: props.orderDiscount ?? null,
    customFields: props.customFields,
    delivery: deliveryResponseOf(props),
    version: props.version,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

export function toOrderListItem(input: {
  readonly row: OrderListRow;
  readonly contactName: string | null;
  readonly paymentTotals: PaymentTotals;
}): OrderListItem {
  const { row } = input;
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    status: row.status,
    contactName: input.contactName,
    grandTotal: row.grandTotal,
    paymentStatus: derivePaymentStatus(row.grandTotal, input.paymentTotals),
    createdAt: row.createdAt.toISOString(),
  };
}

function deliveryResponseOf(order: OrderProps): OrderDeliveryResponse | null {
  const method = order.fulfillment.method;
  if (method !== FULFILLMENT_METHOD.COURIER && method !== FULFILLMENT_METHOD.OWN_RIDER) {
    return null;
  }
  return {
    address: order.deliveryAddress,
    deliveryZoneId: order.deliveryZoneId,
    shippedAt: order.shippedAt === null ? null : order.shippedAt.toISOString(),
    deliveredAt: order.deliveredAt === null || order.deliveredAt === undefined ? null : order.deliveredAt.toISOString(),
    currentDeliveryAttemptId: order.currentDeliveryAttemptId,
    deliveryAttemptCount: order.deliveryAttemptCount,
    firstShipment: firstShipmentResponseOf(order.firstShipment),
  };
}

function firstShipmentResponseOf(
  facts: FirstShipmentPostingFacts | null,
): FirstShipmentResponse | null {
  if (facts === null) return null;
  return {
    shipmentEventId: facts.shipmentEventId,
    deliveryAttemptId: facts.deliveryAttemptId,
    shippedAt: facts.shippedAt.toISOString(),
    businessDate: facts.businessDate,
    netRevenue: facts.netRevenue,
    taxTotal: facts.taxTotal,
    deliveryIncome: facts.deliveryIncome,
    netPaidAtShipment: facts.netPaidAtShipment,
  };
}
