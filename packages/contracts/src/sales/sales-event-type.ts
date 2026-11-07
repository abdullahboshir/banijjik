/**
 * Sales domain events of card 3.5a. Payloads carry identifiers only; inventory, accounting and
 * reporting read the order through the module's public index when they consume one.
 */
export const SALES_EVENT_TYPE = Object.freeze({
  ORDER_DRAFTED: "sales.order.drafted",
  ORDER_PLACED: "sales.order.placed",
  ORDER_CONFIRMED: "sales.order.confirmed",
  ORDER_UPDATED: "sales.order.updated",
  ORDER_PACKED: "sales.order.packed",
  ORDER_SHIPPED: "sales.order.shipped",
  ORDER_DELIVERY_FAILED: "sales.order.deliveryFailed",
  ORDER_DELIVERED: "sales.order.delivered",
  ORDER_RETURNED_TO_SENDER: "sales.order.returned",
  ORDER_DELIVERY_LOSS_CLOSED: "sales.order.lossClosed",
  DELIVERY_LOSS_RECOVERED: "sales.deliveryLoss.recovered",
  ORDER_COMPLETED: "sales.order.completed",
  ORDER_CANCELLED: "sales.order.cancelled",
  /** A return of goods from a completed order (plan 3.5b decision 8). */
  SALES_RETURN_CREATED: "sales.return.created",
  SALES_RETURN_REVERSED: "sales.return.reversed",
} as const);

export type SalesEventType = (typeof SALES_EVENT_TYPE)[keyof typeof SALES_EVENT_TYPE];

export interface OrderEventPayload {
  readonly orderId: string;
}

export interface SalesReturnEventPayload {
  readonly salesReturnId: string;
  readonly orderId: string;
}

export interface DeliveryLossRecoveredEventPayload {
  readonly deliveryLossRecoveryId: string;
  readonly deliveryLossClosureId: string;
  readonly orderId: string;
}
