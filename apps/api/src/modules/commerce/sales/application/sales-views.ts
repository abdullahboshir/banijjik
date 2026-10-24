import type { OrderListItem, OrderResponse } from "@banijjik/contracts/sales";
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
    businessDate: props.businessDate,
    source: props.source,
    approval: props.approval,
    note: props.note,
    orderDiscount: props.orderDiscount ?? null,
    customFields: props.customFields,
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
