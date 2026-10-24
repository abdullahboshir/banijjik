import type { Translator } from "@banijjik/i18n";
import {
  buildCancelReasons,
  buildFulfillment,
  buildHistoryActions,
  buildPaymentStatuses,
  buildSources,
  buildStatuses,
  type T,
} from "./order-label-enums";
import type {
  OrderListLabels,
  OrderDetailLabels,
  OrderActionLabels,
  OrderCancelLabels,
  OrderNewLabels,
  OrderLineLabels,
  OrderQuoteLabels,
  OrderApprovalLabels,
  OrderContactLabels,
  OrderEditLabels,
  OrderHistoryLabels,
  OrderLabels,
} from "./order-label-types";

export type {
  OrderListLabels,
  OrderDetailLabels,
  OrderActionLabels,
  OrderCancelLabels,
  OrderNewLabels,
  OrderLineLabels,
  OrderQuoteLabels,
  OrderApprovalLabels,
  OrderContactLabels,
  OrderEditLabels,
  OrderHistoryLabels,
  OrderLabels,
} from "./order-label-types";

function listLabelsOf(t: T): OrderListLabels {
  return {
    title: t("orders.list.title"),
    subtitle: t("orders.list.subtitle"),
    newOrder: t("orders.list.new"),
    empty: t("orders.list.empty"),
    search: t("orders.list.search"),
    searchPlaceholder: t("orders.list.searchPlaceholder"),
    statusFilter: t("orders.list.status"),
    statusAll: t("orders.list.statusAll"),
    locationFilter: t("orders.list.location"),
    locationAll: t("orders.list.locationAll"),
    apply: t("orders.list.apply"),
    reset: t("orders.list.reset"),
    previous: t("orders.list.previous"),
    next: t("orders.list.next"),
    page: t("orders.list.page"),
    number: t("orders.list.number"),
    contact: t("orders.list.contact"),
    date: t("orders.list.date"),
    total: t("orders.list.total"),
    payment: t("orders.list.payment"),
    unnumbered: t("orders.list.unnumbered"),
    open: t("orders.list.open"),
  };
}

function detailLabelsOf(t: T): OrderDetailLabels {
  return {
    back: t("orders.detail.back"),
    titleFallback: t("orders.detail.titleFallback"),
    invoice: t("orders.detail.invoice"),
    noInvoice: t("orders.detail.noInvoice"),
    location: t("orders.detail.location"),
    contact: t("orders.detail.contact"),
    noContact: t("orders.detail.noContact"),
    fulfillment: t("orders.detail.fulfillment"),
    source: t("orders.detail.source"),
    note: t("orders.detail.note"),
    created: t("orders.detail.created"),
    updated: t("orders.detail.updated"),
    lines: t("orders.detail.lines"),
    emptyLines: t("orders.detail.emptyLines"),
    quantity: t("orders.detail.quantity"),
    unitPrice: t("orders.detail.unitPrice"),
    lineDiscount: t("orders.detail.lineDiscount"),
    lineTotal: t("orders.detail.lineTotal"),
    modifiers: t("orders.detail.modifiers"),
    subtotal: t("orders.detail.subtotal"),
    discount: t("orders.detail.discount"),
    tax: t("orders.detail.tax"),
    delivery: t("orders.detail.delivery"),
    rounding: t("orders.detail.rounding"),
    total: t("orders.detail.total"),
    due: t("orders.detail.due"),
    paymentStatus: t("orders.detail.paymentStatus"),
    receivePayment: t("orders.detail.receivePayment"),
    payment: t("orders.detail.payment"),
    summary: t("orders.detail.summary"),
    totals: t("orders.detail.totals"),
    history: t("orders.detail.history"),
    historyEmpty: t("orders.detail.historyEmpty"),
    actionsTitle: t("orders.detail.actions"),
    deleteDescription: t("orders.detail.deleteDescription"),
  };
}

function actionsLabelsOf(t: T): OrderActionLabels {
  return {
    edit: t("orders.action.edit"),
    place: t("orders.action.place"),
    confirm: t("orders.action.confirm"),
    pack: t("orders.action.pack"),
    complete: t("orders.action.complete"),
    cancel: t("orders.action.cancel"),
    deleteDraft: t("orders.action.deleteDraft"),
    receivePayment: t("orders.detail.receivePayment"),
    close: t("orders.action.close"),
    save: t("orders.action.save"),
  };
}

function cancelDialogLabelsOf(t: T): OrderCancelLabels {
  return {
    title: t("orders.cancel.title"),
    description: t("orders.cancel.description"),
    storeCredit: t("orders.cancel.storeCredit"),
    reason: t("orders.cancel.reason"),
    reasonPlaceholder: t("orders.cancel.reasonPlaceholder"),
    reasonRequired: t("orders.cancel.reasonRequired"),
    pickContact: t("orders.cancel.pickContact"),
    submit: t("orders.cancel.submit"),
    keep: t("orders.cancel.keep"),
    success: t("orders.cancel.success"),
  };
}

function newOrderLabelsOf(t: T): OrderNewLabels {
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
  };
}

function lineLabelsOf(t: T): OrderLineLabels {
  return {
    product: t("orders.line.product"),
    searchPlaceholder: t("orders.line.searchPlaceholder"),
    searching: t("orders.line.searching"),
    noResults: t("orders.line.noResults"),
    searchFailed: t("orders.line.searchFailed"),
    loadFailed: t("orders.line.loadFailed"),
    change: t("orders.line.change"),
    variant: t("orders.line.variant"),
    none: t("orders.line.none"),
    quantity: t("orders.line.quantity"),
    quantityRule: t("orders.line.quantityRule"),
    modifiers: t("orders.line.modifiers"),
    required: t("orders.line.required"),
    discount: t("orders.line.discount"),
    discountNone: t("orders.line.discountNone"),
    discountPercent: t("orders.line.discountPercent"),
    discountAmount: t("orders.line.discountAmount"),
    discountValue: t("orders.line.discountValue"),
    unitPrice: t("orders.line.unitPrice"),
    quantityInvalid: t("orders.line.quantityInvalid"),
    discountInvalid: t("orders.line.discountInvalid"),
    remove: t("orders.line.remove"),
  };
}

function quoteLabelsOf(t: T): OrderQuoteLabels {
  return {
    title: t("orders.quote.title"),
    subtotal: t("orders.quote.subtotal"),
    discount: t("orders.quote.discount"),
    tax: t("orders.quote.tax"),
    total: t("orders.quote.total"),
    rounding: t("orders.quote.rounding"),
    calculating: t("orders.quote.calculating"),
    failed: t("orders.quote.failed"),
    approvalRequired: t("orders.quote.approvalRequired"),
    lineDiscount: t("orders.quote.lineDiscount"),
    lineTax: t("orders.quote.lineTax"),
  };
}

function approvalLabelsOf(t: T): OrderApprovalLabels {
  return {
    title: t("orders.approval.title"),
    approver: t("orders.approval.approver"),
    pin: t("orders.approval.pin"),
    submit: t("orders.approval.submit"),
    cancel: t("orders.approval.cancel"),
    close: t("orders.approval.close"),
    locked: t("orders.approval.locked"),
    failed: t("orders.approval.failed"),
    loadFailed: t("orders.approval.loadFailed"),
    noApprovers: t("orders.approval.noApprovers"),
  };
}

function contactLabelsOf(t: T): OrderContactLabels {
  return {
    search: t("form.contactLink.search"),
    noResults: t("form.contactLink.noResults"),
    createNew: t("form.contactLink.createNew"),
    name: t("form.contactLink.name"),
    phone: t("form.contactLink.phone"),
    change: t("form.contactLink.change"),
    remove: t("form.contactLink.remove"),
    linked: t("form.contactLink.linked"),
    willCreate: t("form.contactLink.willCreate"),
    phoneInvalid: t("orders.contact.phoneInvalid"),
    createFailed: t("orders.contact.createFailed"),
  };
}

function editLabelsOf(t: T): OrderEditLabels {
  return {
    title: t("orders.edit.title"),
    subtitle: t("orders.edit.subtitle"),
    save: t("orders.edit.save"),
    success: t("orders.edit.success"),
    close: t("orders.edit.close"),
    noLines: t("orders.edit.noLines"),
  };
}

function historyLabelsOf(t: T): OrderHistoryLabels {
  return {
    title: t("orders.detail.history"),
    empty: t("orders.detail.historyEmpty"),
    system: t("orders.history.system"),
    actions: buildHistoryActions(t),
  };
}

export function orderLabelsOf(t: T): OrderLabels {
  return {
    list: listLabelsOf(t),
    detail: detailLabelsOf(t),
    actions: actionsLabelsOf(t),
    cancelDialog: cancelDialogLabelsOf(t),
    newOrder: newOrderLabelsOf(t),
    line: lineLabelsOf(t),
    quote: quoteLabelsOf(t),
    approval: approvalLabelsOf(t),
    contact: contactLabelsOf(t),
    edit: editLabelsOf(t),
    history: historyLabelsOf(t),
    status: buildStatuses(t),
    paymentStatus: buildPaymentStatuses(t),
    fulfillment: buildFulfillment(t),
    source: buildSources(t),
    cancelReason: buildCancelReasons(t),
  };
}

/** A unit's words for the quantity hint; the key exists for every catalog unit. */
export function orderUnitLabel(translator: Translator, unitKey: string): string {
  const key = `catalog.unit.${unitKey}`;
  return translator.has(key) ? translator.t(key) : unitKey;
}
