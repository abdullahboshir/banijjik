import type { Translator } from "@banijjik/i18n";

export interface PosPayLabels {
  readonly title: string;
  readonly cash: string;
  readonly received: string;
  readonly change: string;
  readonly addRow: string;
  readonly amount: string;
  readonly quickCash: string;
  readonly methodBkash: string;
  readonly methodNagad: string;
  readonly methodCard: string;
  readonly methodBank: string;
  readonly refusalInvalidAmount: string;
  readonly refusalOverpaymentNotCash: string;
  readonly refusalCashShort: string;
  readonly refusalTooManyRows: string;
  readonly quoteFailed: string;
  readonly back: string;
  readonly confirm: string;
}

export interface PosReceiptLabels {
  readonly title: string;
  readonly print: string;
  readonly width: string;
  readonly newSale: string;
  readonly number: string;
  readonly date: string;
  readonly discount: string;
  readonly paid: string;
  readonly due: string;
  readonly change: string;
}

/** Every visible string of the till, resolved on the server so the client bundle carries no catalog. */
export interface PosLabels {
  readonly title: string;
  readonly pairTitle: string;
  readonly pairHint: string;
  readonly pairCode: string;
  readonly pairSubmit: string;
  readonly pairInvalid: string;
  readonly openTitle: string;
  readonly openFloat: string;
  readonly openSubmit: string;
  readonly alreadyOpen: string;
  readonly searchPlaceholder: string;
  readonly noResults: string;
  readonly cart: string;
  readonly cartEmpty: string;
  readonly total: string;
  readonly clear: string;
  readonly remove: string;
  readonly quantity: string;
  readonly add: string;
  readonly pay: string;
  readonly saleSaved: string;
  readonly saleFailed: string;
  readonly loading: string;
  readonly loadFailed: string;
  readonly retry: string;
  readonly noDevice: string;
  readonly offline: string;
  readonly permissionDenied: string;
  readonly payLabels: PosPayLabels;
  readonly receiptLabels: PosReceiptLabels;
}

function payLabelsOf(t: Translator["t"]): PosPayLabels {
  return {
    title: t("pos.pay.title"),
    cash: t("pos.pay.cash"),
    received: t("pos.pay.received"),
    change: t("pos.pay.change"),
    addRow: t("pos.pay.addRow"),
    amount: t("pos.pay.amount"),
    quickCash: t("pos.pay.quickCash"),
    methodBkash: t("pos.pay.method.bkash"),
    methodNagad: t("pos.pay.method.nagad"),
    methodCard: t("pos.pay.method.card"),
    methodBank: t("pos.pay.method.bank"),
    refusalInvalidAmount: t("pos.pay.refusal.invalidAmount"),
    refusalOverpaymentNotCash: t("pos.pay.refusal.overpaymentNotCash"),
    refusalCashShort: t("pos.pay.refusal.cashShort"),
    refusalTooManyRows: t("pos.pay.refusal.tooManyRows"),
    quoteFailed: t("pos.pay.quoteFailed"),
    back: t("pos.pay.back"),
    confirm: t("pos.pay.confirm"),
  };
}

function receiptLabelsOf(t: Translator["t"]): PosReceiptLabels {
  return {
    title: t("pos.receipt.title"),
    print: t("pos.receipt.print"),
    width: t("pos.receipt.width"),
    newSale: t("pos.receipt.newSale"),
    number: t("pos.receipt.number"),
    date: t("pos.receipt.date"),
    discount: t("pos.receipt.discount"),
    paid: t("pos.receipt.paid"),
    due: t("pos.receipt.due"),
    change: t("pos.pay.change"),
  };
}

export function posLabelsOf(translator: Translator): PosLabels {
  const { t } = translator;
  return {
    title: t("pos.title"),
    pairTitle: t("pos.pair.title"),
    pairHint: t("pos.pair.hint"),
    pairCode: t("pos.pair.code"),
    pairSubmit: t("pos.pair.submit"),
    pairInvalid: t("pos.pair.invalid"),
    openTitle: t("pos.session.openTitle"),
    openFloat: t("pos.session.float"),
    openSubmit: t("pos.session.open"),
    alreadyOpen: t("pos.session.alreadyOpen"),
    searchPlaceholder: t("pos.sale.search"),
    noResults: t("pos.sale.noResults"),
    cart: t("pos.sale.cart"),
    cartEmpty: t("pos.sale.empty"),
    total: t("pos.sale.total"),
    clear: t("pos.sale.clear"),
    remove: t("pos.sale.remove"),
    quantity: t("pos.sale.quantity"),
    add: t("pos.sale.add"),
    pay: t("pos.sale.pay"),
    saleSaved: t("pos.sale.saved"),
    saleFailed: t("pos.sale.failed"),
    loading: t("pos.state.loading"),
    loadFailed: t("pos.state.loadFailed"),
    retry: t("pos.state.retry"),
    noDevice: t("pos.state.noDevice"),
    offline: t("pos.state.offline"),
    permissionDenied: t("state.permissionDenied"),
    payLabels: payLabelsOf(t),
    receiptLabels: receiptLabelsOf(t),
  };
}
