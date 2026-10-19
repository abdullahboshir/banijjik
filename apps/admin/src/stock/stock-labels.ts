import type { Translator } from "@banijjik/i18n";

export interface StockLabels {
  title: string;
  subtitle: string;
  readOnly: string;
  receive: string;
  adjust: string;
  newItem: string;
  searchLabel: string;
  searchSubmit: string;
  locationLabel: string;
  lowOnly: string;
  columnName: string;
  columnOnHand: string;
  columnAvailable: string;
  columnValue: string;
  empty: string;
  noMatch: string;
  lowBadge: string;
  pagePrevious: string;
  pageNext: string;
  pageCurrent: string;
  transfersTitle: string;
  transfersSubtitle: string;
  adjustmentsTitle: string;
  adjustmentsSubtitle: string;
  backToStock: string;
}

export function stockLabelsOf(t: Translator["t"]): StockLabels {
  return {
    title: t("stock.list.title"),
    subtitle: t("stock.list.subtitle"),
    readOnly: t("stock.readOnly"),
    receive: t("stock.receive.open"),
    adjust: t("stock.adjust.open"),
    newItem: t("stock.item.create"),
    searchLabel: t("stock.search.label"),
    searchSubmit: t("stock.search.submit"),
    locationLabel: t("stock.filter.location"),
    lowOnly: t("stock.filter.lowOnly"),
    columnName: t("stock.column.name"),
    columnOnHand: t("stock.column.onHand"),
    columnAvailable: t("stock.column.available"),
    columnValue: t("stock.column.value"),
    empty: t("stock.list.empty"),
    noMatch: t("stock.list.noMatch"),
    lowBadge: t("stock.lowBadge"),
    pagePrevious: t("stock.page.previous"),
    pageNext: t("stock.page.next"),
    pageCurrent: t("stock.page.current"),
    transfersTitle: t("stock.transfers.title"),
    transfersSubtitle: t("stock.transfers.subtitle"),
    adjustmentsTitle: t("stock.adjustments.title"),
    adjustmentsSubtitle: t("stock.adjustments.subtitle"),
    backToStock: t("stock.detail.back"),
  };
}

export interface ReceiveStockLabels {
  title: string;
  close: string;
  save: string;
  location: string;
  supplierNote: string;
  item: string;
  quantity: string;
  unitCost: string;
  addLine: string;
  removeLine: string;
  conflict: string;
  reload: string;
}

export function receiveStockLabelsOf(t: Translator["t"]): ReceiveStockLabels {
  return {
    title: t("stock.receive.title"),
    close: t("stock.sheet.close"),
    save: t("stock.receive.submit"),
    location: t("stock.field.location"),
    supplierNote: t("stock.receive.supplierNote"),
    item: t("stock.field.item"),
    quantity: t("stock.field.quantity"),
    unitCost: t("stock.field.unitCost"),
    addLine: t("stock.receive.addLine"),
    removeLine: t("stock.receive.removeLine"),
    conflict: t("stock.conflict"),
    reload: t("stock.reload"),
  };
}

export interface AdjustStockLabels {
  title: string;
  close: string;
  save: string;
  location: string;
  item: string;
  quantityDelta: string;
  reason: string;
  reasonAdjustment: string;
  reasonDamage: string;
  note: string;
  addLine: string;
  removeLine: string;
  conflict: string;
  reload: string;
  approvalTitle: string;
  approvalApprover: string;
  approvalPin: string;
  approvalSubmit: string;
  approvalCancel: string;
  approvalClose: string;
  approvalLocked: string;
}

export function adjustStockLabelsOf(t: Translator["t"]): AdjustStockLabels {
  return {
    title: t("stock.adjust.title"),
    close: t("stock.sheet.close"),
    save: t("stock.adjust.submit"),
    location: t("stock.field.location"),
    item: t("stock.field.item"),
    quantityDelta: t("stock.adjust.quantityDelta"),
    reason: t("stock.adjust.reason"),
    reasonAdjustment: t("stock.adjust.reason.ADJUSTMENT"),
    reasonDamage: t("stock.adjust.reason.DAMAGE_WRITE_OFF"),
    note: t("stock.adjust.note"),
    addLine: t("stock.adjust.addLine"),
    removeLine: t("stock.adjust.removeLine"),
    conflict: t("stock.conflict"),
    reload: t("stock.reload"),
    approvalTitle: t("stock.approval.title"),
    approvalApprover: t("stock.approval.approver"),
    approvalPin: t("stock.approval.pin"),
    approvalSubmit: t("stock.approval.submit"),
    approvalCancel: t("stock.approval.cancel"),
    approvalClose: t("stock.approval.close"),
    approvalLocked: t("errors.approval_pin_locked"),
  };
}

export interface TransferLabels {
  from: string;
  to: string;
  item: string;
  quantity: string;
  addLine: string;
  removeLine: string;
  submit: string;
  conflict: string;
  reload: string;
}

export function transferLabelsOf(t: Translator["t"]): TransferLabels {
  return {
    from: t("stock.transfers.from"),
    to: t("stock.transfers.to"),
    item: t("stock.field.item"),
    quantity: t("stock.field.quantity"),
    addLine: t("stock.transfers.addLine"),
    removeLine: t("stock.transfers.removeLine"),
    submit: t("stock.transfers.submit"),
    conflict: t("stock.conflict"),
    reload: t("stock.reload"),
  };
}

export interface ItemDetailLabels {
  sku: string;
  unit: string;
  threshold: string;
  status: string;
  statusActive: string;
  statusArchived: string;
  levelsTitle: string;
  levelsLocation: string;
  levelsOnHand: string;
  levelsAvailable: string;
  movementsTitle: string;
  movementWhen: string;
  movementLocation: string;
  movementDelta: string;
  movementReason: string;
  noMovements: string;
}

export function itemDetailLabelsOf(t: Translator["t"]): ItemDetailLabels {
  return {
    sku: t("stock.item.sku"),
    unit: t("stock.item.unit"),
    threshold: t("stock.item.lowThreshold"),
    status: t("stock.item.status"),
    statusActive: t("stock.item.status.ACTIVE"),
    statusArchived: t("stock.item.status.ARCHIVED"),
    levelsTitle: t("stock.item.levelsTitle"),
    levelsLocation: t("stock.item.levelsLocation"),
    levelsOnHand: t("stock.column.onHand"),
    levelsAvailable: t("stock.column.available"),
    movementsTitle: t("stock.item.movementsTitle"),
    movementWhen: t("stock.movement.when"),
    movementLocation: t("stock.movement.location"),
    movementDelta: t("stock.movement.delta"),
    movementReason: t("stock.movement.reason"),
    noMovements: t("stock.item.noMovements"),
  };
}

export interface NewItemLabels {
  title: string;
  close: string;
  save: string;
  name: string;
  sku: string;
  unit: string;
  conflict: string;
  reload: string;
}

export function newItemLabelsOf(t: Translator["t"]): NewItemLabels {
  return {
    title: t("stock.item.createTitle"),
    close: t("stock.sheet.close"),
    save: t("stock.item.createSubmit"),
    name: t("stock.item.name"),
    sku: t("stock.item.skuField"),
    unit: t("stock.item.unit"),
    conflict: t("stock.conflict"),
    reload: t("stock.reload"),
  };
}

export interface ItemPickerLabels {
  search: string;
  searching: string;
  empty: string;
}

export function itemPickerLabelsOf(t: Translator["t"]): ItemPickerLabels {
  return {
    search: t("stock.item.search"),
    searching: t("stock.item.searching"),
    empty: t("stock.item.searchEmpty"),
  };
}
