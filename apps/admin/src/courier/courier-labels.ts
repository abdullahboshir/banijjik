import type { CourierLabels } from "./courier-types";

type T = (key: string, values?: Record<string, string | number>) => string;

export function courierLabelsOf(t: T): CourierLabels {
  return {
    title: t("courier.title"),
    subtitle: t("courier.subtitle"),
    empty: t("courier.empty"),
    courierKey: t("courier.courierKey"),
    trackingNumber: t("courier.trackingNumber"),
    orderId: t("courier.orderId"),
    location: t("courier.location"),
    status: t("courier.status"),
    created: t("courier.created"),
    filterCourierAll: t("courier.filterCourierAll"),
    recordSettlement: t("courier.recordSettlement"),
    reverseSettlement: t("courier.reverseSettlement"),
    close: t("common.close"),
    settlement: {
      title: t("courier.settlement.title"),
      description: t("courier.settlement.description"),
      courier: t("courier.settlement.courier"),
      reference: t("courier.settlement.reference"),
      referencePlaceholder: t("courier.settlement.referencePlaceholder"),
      charges: t("courier.settlement.charges"),
      chargesPlaceholder: t("courier.settlement.chargesPlaceholder"),
      receivedVia: t("courier.settlement.receivedVia"),
      businessDate: t("courier.settlement.businessDate"),
      payments: t("courier.settlement.payments"),
      paymentsPlaceholder: t("courier.settlement.paymentsPlaceholder"),
      submit: t("courier.settlement.submit"),
      success: t("courier.settlement.success"),
    },
    reverse: {
      title: t("courier.reverse.title"),
      description: t("courier.reverse.description"),
      reason: t("courier.reverse.reason"),
      reasonPlaceholder: t("courier.reverse.reasonPlaceholder"),
      submit: t("courier.reverse.submit"),
      success: t("courier.reverse.success"),
    },
  };
}
