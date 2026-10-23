import type { Translator } from "@banijjik/i18n";

function labelsOf(t: Translator["t"]) {
  return {
    title: t("storeCredit.title"),
    help: t("storeCredit.help"),
    balance: t("storeCredit.balance"),
    history: t("storeCredit.history"),
    empty: t("storeCredit.empty"),
    adjust: t("storeCredit.adjust"),
    amount: t("storeCredit.amount"),
    reason: t("storeCredit.reason"),
    direction: t("storeCredit.direction"),
    credit: t("storeCredit.credit"),
    debit: t("storeCredit.debit"),
    location: t("storeCredit.location"),
    save: t("storeCredit.save"),
    invalid: t("storeCredit.invalid"),
    adjusted: t("storeCredit.adjusted"),
    noApprovers: t("storeCredit.noApprovers"),
    previous: t("dues.previous"),
    next: t("dues.next"),
    conflict: t("storeCredit.conflict"),
    approval: {
      title: t("storeCredit.approval.title"),
      approver: t("contacts.credits.approval.approver"),
      pin: t("contacts.credits.approval.pin"),
      submit: t("contacts.credits.approval.submit"),
      cancel: t("contacts.credits.approval.cancel"),
      close: t("contacts.credits.approval.close"),
      locked: t("contacts.credits.approval.locked"),
    },
    kinds: {
      PAYMENT_OVERPAYMENT: t("storeCredit.kind.PAYMENT_OVERPAYMENT"),
      PAYMENT_USE: t("storeCredit.kind.PAYMENT_USE"),
      PAYMENT_REFUND: t("storeCredit.kind.PAYMENT_REFUND"),
      PAYMENT_REVERSAL: t("storeCredit.kind.PAYMENT_REVERSAL"),
      CANCELLATION: t("storeCredit.kind.CANCELLATION"),
      MANUAL_ADJUSTMENT: t("storeCredit.kind.MANUAL_ADJUSTMENT"),
      EXPIRY: t("storeCredit.kind.EXPIRY"),
    },
  };
}

export type StoreCreditLabels = ReturnType<typeof labelsOf>;

export function storeCreditLabelsOf(t: Translator["t"]): StoreCreditLabels {
  return labelsOf(t);
}
