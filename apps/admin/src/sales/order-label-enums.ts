import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  FULFILLMENT_METHOD,
  ORDER_SOURCE,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SALES_CANCEL_REASON,
  type FulfillmentMethod,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus,
  type SalesCancelReason,
} from "@banijjik/contracts/sales";
import type { Translator } from "@banijjik/i18n";

export type T = Translator["t"];

export function buildStatuses(t: T): Readonly<Record<OrderStatus, string>> {
  return {
    [ORDER_STATUS.DRAFT]: t("orders.status.DRAFT"),
    [ORDER_STATUS.PLACED]: t("orders.status.PLACED"),
    [ORDER_STATUS.CONFIRMED]: t("orders.status.CONFIRMED"),
    [ORDER_STATUS.PACKED]: t("orders.status.PACKED"),
    [ORDER_STATUS.SHIPPED]: t("orders.status.SHIPPED"),
    [ORDER_STATUS.DELIVERED]: t("orders.status.DELIVERED"),
    [ORDER_STATUS.COMPLETED]: t("orders.status.COMPLETED"),
    [ORDER_STATUS.DELIVERY_FAILED]: t("orders.status.DELIVERY_FAILED"),
    [ORDER_STATUS.RETURNED_TO_SENDER]: t("orders.status.RETURNED_TO_SENDER"),
    [ORDER_STATUS.CANCELLED]: t("orders.status.CANCELLED"),
  };
}

export function buildPaymentStatuses(t: T): Readonly<Record<PaymentStatus, string>> {
  return {
    [PAYMENT_STATUS.UNPAID]: t("orders.paymentStatus.UNPAID"),
    [PAYMENT_STATUS.PARTIAL]: t("orders.paymentStatus.PARTIAL"),
    [PAYMENT_STATUS.PAID]: t("orders.paymentStatus.PAID"),
    [PAYMENT_STATUS.REFUNDED]: t("orders.paymentStatus.REFUNDED"),
    [PAYMENT_STATUS.PARTIALLY_REFUNDED]: t("orders.paymentStatus.PARTIALLY_REFUNDED"),
  };
}

export function buildFulfillment(t: T): Readonly<Record<FulfillmentMethod, string>> {
  return {
    [FULFILLMENT_METHOD.INSTANT]: t("orders.fulfillment.INSTANT"),
    [FULFILLMENT_METHOD.PICKUP]: t("orders.fulfillment.PICKUP"),
    [FULFILLMENT_METHOD.COURIER]: t("orders.fulfillment.COURIER"),
    [FULFILLMENT_METHOD.OWN_RIDER]: t("orders.fulfillment.OWN_RIDER"),
  };
}

export function buildCancelReasons(t: T): Readonly<Record<SalesCancelReason, string>> {
  return {
    [SALES_CANCEL_REASON.AUTO_PLACED_TIMEOUT]: t("orders.cancelReason.AUTO_PLACED_TIMEOUT"),
  };
}

export function buildSources(t: T): Readonly<Record<OrderSource, string>> {
  return {
    [ORDER_SOURCE.ADMIN]: t("orders.source.ADMIN"),
    [ORDER_SOURCE.STOREFRONT]: t("orders.source.STOREFRONT"),
    [ORDER_SOURCE.BOT]: t("orders.source.BOT"),
    [ORDER_SOURCE.API]: t("orders.source.API"),
    [ORDER_SOURCE.POS]: t("orders.source.POS"),
  };
}

export function buildHistoryActions(t: T): Readonly<Record<string, string>> {
  return {
    [AUDIT_ACTION.ORDER_DRAFTED]: t("orders.history.action.drafted"),
    [AUDIT_ACTION.ORDER_PLACED]: t("orders.history.action.placed"),
    [AUDIT_ACTION.ORDER_CONFIRMED]: t("orders.history.action.confirmed"),
    [AUDIT_ACTION.ORDER_UPDATED]: t("orders.history.action.updated"),
    [AUDIT_ACTION.ORDER_PACKED]: t("orders.history.action.packed"),
    [AUDIT_ACTION.ORDER_COMPLETED]: t("orders.history.action.completed"),
    [AUDIT_ACTION.ORDER_CANCELLED]: t("orders.history.action.cancelled"),
  };
}
