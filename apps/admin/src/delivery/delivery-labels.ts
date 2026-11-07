import type { DeliveryLabels } from "./delivery-types";

type T = (key: string, values?: Record<string, string | number>) => string;

export function deliveryLabelsOf(t: T): DeliveryLabels {
  return {
    title: t("delivery.title"),
    subtitle: t("delivery.subtitle"),
    empty: t("delivery.empty"),
    rider: t("delivery.rider"),
    orderId: t("delivery.orderId"),
    status: t("delivery.status"),
    statusAll: t("delivery.statusAll"),
    location: t("delivery.location"),
    notes: t("delivery.notes"),
    created: t("delivery.created"),
    recordHandover: t("delivery.recordHandover"),
    reverseHandover: t("delivery.reverseHandover"),
    close: t("common.close"),
    handover: {
      title: t("delivery.handover.title"),
      description: t("delivery.handover.description"),
      rider: t("delivery.handover.rider"),
      receivedVia: t("delivery.handover.receivedVia"),
      businessDate: t("delivery.handover.businessDate"),
      posSessionId: t("delivery.handover.posSessionId"),
      posSessionPlaceholder: t("delivery.handover.posSessionPlaceholder"),
      payments: t("delivery.handover.payments"),
      paymentsPlaceholder: t("delivery.handover.paymentsPlaceholder"),
      submit: t("delivery.handover.submit"),
      success: t("delivery.handover.success"),
    },
    reverse: {
      title: t("delivery.reverse.title"),
      description: t("delivery.reverse.description"),
      reason: t("delivery.reverse.reason"),
      reasonPlaceholder: t("delivery.reverse.reasonPlaceholder"),
      submit: t("delivery.reverse.submit"),
      success: t("delivery.reverse.success"),
    },
  };
}
