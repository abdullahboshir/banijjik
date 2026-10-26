import type { Translator } from "@banijjik/i18n";

type T = Translator["t"];

/** The exchange sheet's own text; the return and order screens' labels are reused for everything else. */
export interface ExchangeLabels {
  readonly title: string;
  readonly description: string;
  readonly stepReturn: string;
  readonly stepNewLines: string;
  readonly stepPayment: string;
  readonly next: string;
  readonly back: string;
  readonly noNewLines: string;
  readonly invalidLines: string;
  readonly previewNeeded: string;
  readonly creditUsed: string;
  readonly creditLeft: string;
  readonly creditNote: string;
  readonly newTotal: string;
  readonly due: string;
  readonly paymentsTitle: string;
  readonly addPayment: string;
  readonly removePayment: string;
  readonly paymentMethod: string;
  readonly paymentAmount: string;
  readonly leftToPay: string;
  readonly maxPayments: string;
  readonly noPayment: string;
  readonly amountRequired: string;
  readonly referenceRequired: string;
  readonly submit: string;
  readonly resultTitle: string;
  readonly resultLead: string;
  readonly openReturn: string;
  readonly openOrder: string;
  readonly close: string;
}

/** Every exchange label, read from the screen catalogs (BN and EN keys). */
export function exchangeLabelsOf(t: T): ExchangeLabels {
  return {
    title: t("returns.exchange.title"),
    description: t("returns.exchange.description"),
    stepReturn: t("returns.exchange.stepReturn"),
    stepNewLines: t("returns.exchange.stepNewLines"),
    stepPayment: t("returns.exchange.stepPayment"),
    next: t("returns.exchange.next"),
    back: t("returns.exchange.back"),
    noNewLines: t("returns.exchange.noNewLines"),
    invalidLines: t("returns.exchange.invalidLines"),
    previewNeeded: t("returns.exchange.previewNeeded"),
    creditUsed: t("returns.exchange.creditUsed"),
    creditLeft: t("returns.exchange.creditLeft"),
    creditNote: t("returns.exchange.creditNote"),
    newTotal: t("returns.exchange.newTotal"),
    due: t("returns.exchange.due"),
    paymentsTitle: t("returns.exchange.paymentsTitle"),
    addPayment: t("returns.exchange.addPayment"),
    removePayment: t("returns.exchange.removePayment"),
    paymentMethod: t("returns.exchange.paymentMethod"),
    paymentAmount: t("returns.exchange.paymentAmount"),
    leftToPay: t("returns.exchange.leftToPay"),
    maxPayments: t("returns.exchange.maxPayments"),
    noPayment: t("returns.exchange.noPayment"),
    amountRequired: t("returns.exchange.amountRequired"),
    referenceRequired: t("returns.exchange.referenceRequired"),
    submit: t("returns.exchange.submit"),
    resultTitle: t("returns.exchange.resultTitle"),
    resultLead: t("returns.exchange.resultLead"),
    openReturn: t("returns.exchange.openReturn"),
    openOrder: t("returns.exchange.openOrder"),
    close: t("returns.exchange.close"),
  };
}
