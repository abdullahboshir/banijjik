import type { Translator } from "@banijjik/i18n";
import { exchangeLabelsOf, type ExchangeLabels } from "./exchange-labels";
import type {
  OrderReturnStatus,
  ReturnDisposition,
  SalesReturnReason,
  SalesReturnStatus,
} from "@banijjik/contracts/sales";
import {
  ORDER_RETURN_STATUS,
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  SALES_RETURN_REVERSE_REASON,
  SALES_RETURN_STATUS,
} from "@banijjik/contracts/sales";

type T = Translator["t"];

/** Builds a label per enum value; the keys are the enum values, so no label can be missed. */
function recordOf<K extends string>(
  values: Readonly<Record<string, K>>,
  labelOf: (key: K) => string,
): Record<K, string> {
  const entries = Object.values(values).map((key) => [key, labelOf(key)] as const);
  return Object.fromEntries(entries) as Record<K, string>;
}

export interface ReturnListLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly empty: string;
  readonly from: string;
  readonly to: string;
  readonly apply: string;
  readonly reset: string;
  readonly orderFilter: string;
  readonly clearOrder: string;
  readonly previous: string;
  readonly next: string;
  readonly number: string;
  readonly value: string;
  readonly refund: string;
  readonly reason: string;
  readonly date: string;
  readonly status: string;
}

export interface ReturnSheetLabels {
  readonly open: string;
  readonly title: string;
  readonly description: string;
  readonly sold: string;
  readonly returned: string;
  readonly left: string;
  readonly fullyReturned: string;
  readonly noLines: string;
  readonly deliveryCharge: string;
  readonly reason: string;
  readonly note: string;
  readonly noteRequired: string;
  readonly preview: string;
  readonly previewValue: string;
  readonly previewDue: string;
  readonly previewRefund: string;
  readonly previewLoading: string;
  readonly previewFailed: string;
  readonly refundMethod: string;
  readonly refundMethodRequired: string;
  readonly refundReference: string;
  readonly noRefund: string;
  readonly submit: string;
  readonly cancel: string;
  readonly success: string;
  readonly decrease: string;
  readonly increase: string;
  readonly disposition: string;
}

export interface ReturnDetailLabels {
  readonly title: string;
  readonly back: string;
  readonly order: string;
  readonly value: string;
  readonly dueReduced: string;
  readonly refund: string;
  readonly refundNone: string;
  readonly reason: string;
  readonly note: string;
  readonly lines: string;
  readonly quantity: string;
  readonly disposition: string;
  readonly reversedAt: string;
  readonly reversalReason: string;
  readonly payback: string;
  readonly paybackNone: string;
  readonly exchange: string;
  readonly openOrder: string;
  readonly date: string;
}

export interface ReturnReverseLabels {
  readonly open: string;
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  readonly note: string;
  readonly noteRequired: string;
  readonly payback: string;
  readonly paybackHint: string;
  readonly paybackMethod: string;
  readonly paybackReference: string;
  readonly submit: string;
  readonly cancel: string;
  readonly success: string;
}

export interface ReturnLabels {
  readonly list: ReturnListLabels;
  readonly sheet: ReturnSheetLabels;
  readonly detail: ReturnDetailLabels;
  readonly reverse: ReturnReverseLabels;
  readonly reasons: Readonly<Record<SalesReturnReason, string>>;
  readonly reverseReasons: Readonly<Record<string, string>>;
  readonly dispositions: Readonly<Record<ReturnDisposition, string>>;
  readonly statuses: Readonly<Record<SalesReturnStatus, string>>;
  readonly orderReturnStatus: Readonly<Record<OrderReturnStatus, string>>;
  readonly orderLink: string;
  /** The "Exchange items" action of a completed order with a customer (plan 3.5b B2). */
  readonly exchangeOpen: string;
  /** The exchange sheet text, built on the server: client components read it as props (screen catalogs are not bundled). */
  readonly exchange: ExchangeLabels;
}

function listLabelsOf(t: T): ReturnListLabels {
  return {
    title: t("returns.list.title"),
    subtitle: t("returns.list.subtitle"),
    empty: t("returns.list.empty"),
    from: t("returns.list.from"),
    to: t("returns.list.to"),
    apply: t("returns.list.apply"),
    reset: t("returns.list.reset"),
    orderFilter: t("returns.list.orderFilter"),
    clearOrder: t("returns.list.clearOrder"),
    previous: t("returns.list.previous"),
    next: t("returns.list.next"),
    number: t("returns.list.number"),
    value: t("returns.list.value"),
    refund: t("returns.list.refund"),
    reason: t("returns.list.reason"),
    date: t("returns.list.date"),
    status: t("returns.list.status"),
  };
}

function sheetLabelsOf(t: T): ReturnSheetLabels {
  return {
    open: t("returns.sheet.open"),
    title: t("returns.sheet.title"),
    description: t("returns.sheet.description"),
    sold: t("returns.sheet.sold"),
    returned: t("returns.sheet.returned"),
    left: t("returns.sheet.left"),
    fullyReturned: t("returns.sheet.fullyReturned"),
    noLines: t("returns.sheet.noLines"),
    deliveryCharge: t("returns.sheet.deliveryCharge"),
    reason: t("returns.sheet.reason"),
    note: t("returns.sheet.note"),
    noteRequired: t("returns.sheet.noteRequired"),
    preview: t("returns.sheet.preview"),
    previewValue: t("returns.sheet.previewValue"),
    previewDue: t("returns.sheet.previewDue"),
    previewRefund: t("returns.sheet.previewRefund"),
    previewLoading: t("returns.sheet.previewLoading"),
    previewFailed: t("returns.sheet.previewFailed"),
    refundMethod: t("returns.sheet.refundMethod"),
    refundMethodRequired: t("returns.sheet.refundMethodRequired"),
    refundReference: t("returns.sheet.refundReference"),
    noRefund: t("returns.sheet.noRefund"),
    submit: t("returns.sheet.submit"),
    cancel: t("returns.sheet.cancel"),
    success: t("returns.sheet.success"),
    decrease: t("returns.sheet.decrease"),
    increase: t("returns.sheet.increase"),
    disposition: t("returns.sheet.disposition"),
  };
}

function detailLabelsOf(t: T): ReturnDetailLabels {
  return {
    title: t("returns.detail.title"),
    back: t("returns.detail.back"),
    order: t("returns.detail.order"),
    value: t("returns.detail.value"),
    dueReduced: t("returns.detail.dueReduced"),
    refund: t("returns.detail.refund"),
    refundNone: t("returns.detail.refundNone"),
    reason: t("returns.detail.reason"),
    note: t("returns.detail.note"),
    lines: t("returns.detail.lines"),
    quantity: t("returns.detail.quantity"),
    disposition: t("returns.detail.disposition"),
    reversedAt: t("returns.detail.reversedAt"),
    reversalReason: t("returns.detail.reversalReason"),
    payback: t("returns.detail.payback"),
    paybackNone: t("returns.detail.paybackNone"),
    exchange: t("returns.detail.exchange"),
    openOrder: t("returns.detail.openOrder"),
    date: t("returns.list.date"),
  };
}

function reverseLabelsOf(t: T): ReturnReverseLabels {
  return {
    open: t("returns.reverse.open"),
    title: t("returns.reverse.title"),
    description: t("returns.reverse.description"),
    reason: t("returns.reverse.reason"),
    note: t("returns.reverse.note"),
    noteRequired: t("returns.reverse.noteRequired"),
    payback: t("returns.reverse.payback"),
    paybackHint: t("returns.reverse.paybackHint"),
    paybackMethod: t("returns.reverse.paybackMethod"),
    paybackReference: t("returns.reverse.paybackReference"),
    submit: t("returns.reverse.submit"),
    cancel: t("returns.reverse.cancel"),
    success: t("returns.reverse.success"),
  };
}

/** Every label of the returns screens, read from the screen catalogs (BN and EN keys). */
export function returnLabelsOf(t: T): ReturnLabels {
  return {
    list: listLabelsOf(t),
    sheet: sheetLabelsOf(t),
    detail: detailLabelsOf(t),
    reverse: reverseLabelsOf(t),
    reasons: recordOf(SALES_RETURN_REASON, (key) => t(`returns.reason.${key}`)),
    reverseReasons: recordOf(SALES_RETURN_REVERSE_REASON, (key) =>
      t(`returns.reverseReason.${key}`),
    ),
    dispositions: recordOf(RETURN_DISPOSITION, (key) => t(`returns.disposition.${key}`)),
    statuses: recordOf(SALES_RETURN_STATUS, (key) => t(`returns.status.${key}`)),
    orderReturnStatus: recordOf(ORDER_RETURN_STATUS, (key) => t(`orders.returnStatus.${key}`)),
    orderLink: t("orders.returns.link"),
    exchangeOpen: t("returns.exchange.open"),
    exchange: exchangeLabelsOf(t),
  };
}
