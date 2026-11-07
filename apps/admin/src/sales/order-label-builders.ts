import type { T } from "./order-label-enums";
import type { OrderNewLabels } from "./order-label-types";

export function newOrderLabelsOf(t: T): OrderNewLabels {
  return {
    title: t("orders.new.title"),
    subtitle: t("orders.new.subtitle"),
    back: t("orders.new.back"),
    location: t("orders.new.location"),
    locationRequired: t("orders.new.locationRequired"),
    fulfillment: t("orders.new.fulfillment"),
    contact: t("orders.new.contact"),
    contactHint: t("orders.new.contactHint"),
    note: t("orders.new.note"),
    orderDiscount: t("orders.new.orderDiscount"),
    lines: t("orders.new.lines"),
    addLine: t("orders.new.addLine"),
    emptyLines: t("orders.new.emptyLines"),
    saveDraft: t("orders.new.saveDraft"),
    place: t("orders.new.place"),
    complete: t("orders.new.complete"),
    draftSaved: t("orders.new.draftSaved"),
    placed: t("orders.new.placed"),
    completed: t("orders.new.completed"),
    failed: t("orders.new.failed"),
    noLinesToPlace: t("orders.new.noLinesToPlace"),
    invalidLine: t("orders.new.invalidLine"),
    openDraft: t("orders.new.openDraft"),
    deliveryAddress: t("orders.new.deliveryAddress"),
    recipientName: t("orders.new.recipientName"),
    recipientPhone: t("orders.new.recipientPhone"),
    addressLine: t("orders.new.addressLine"),
    districtCode: t("orders.new.districtCode"),
    areaCode: t("orders.new.areaCode"),
    postalCode: t("orders.new.postalCode"),
  };
}
