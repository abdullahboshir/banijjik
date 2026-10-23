import type { CreditEntryType, CreditPackStatus } from "@banijjik/contracts/credit";
import type { Translator } from "@banijjik/i18n";

/** All text of the credit screens, translated on the server (the browser bundle has no screen catalog). */
export interface CreditPackLabels {
  title: string;
  subtitle: string;
  readOnly: string;
  add: string;
  empty: string;
  nameBn: string;
  nameEn: string;
  credits: string;
  price: string;
  validityDays: string;
  validityHint: string;
  sortOrder: string;
  sortOrderHint: string;
  save: string;
  archive: string;
  edit: string;
  close: string;
  status: Readonly<Record<CreditPackStatus, string>>;
  summary: string;
  expiresAfter: string;
  neverExpires: string;
  invalid: string;
  conflict: string;
  reload: string;
}

export interface ContactCreditsApprovalLabels {
  title: string;
  approver: string;
  pin: string;
  submit: string;
  cancel: string;
  close: string;
  locked: string;
}

export interface ContactCreditsLabels {
  title: string;
  help: string;
  balance: string;
  balanceValue: string;
  history: string;
  empty: string;
  entry: Readonly<Record<CreditEntryType, string>>;
  expiresOn: string;
  adjust: string;
  adjustCredits: string;
  adjustHint: string;
  adjustReason: string;
  adjustSubmit: string;
  adjusted: string;
  invalid: string;
  location: string;
  locationHelp: string;
  noLocations: string;
  noApprovers: string;
  approval: ContactCreditsApprovalLabels;
}

export interface CreditPaymentMethodsLabels {
  title: string;
  help: string;
  empty: string;
  add: string;
  remove: string;
  method: string;
  methodLabels: Readonly<Record<CreditPurchaseMethod, string>>;
  accountNumber: string;
  accountType: string;
  accountTypeHint: string;
  instructionsBn: string;
  instructionsEn: string;
  save: string;
  saved: string;
  invalid: string;
  conflict: string;
  reload: string;
}

export function creditPackLabelsOf(t: Translator["t"]): CreditPackLabels {
  return {
    title: t("credit.packs.title"),
    subtitle: t("credit.packs.subtitle"),
    readOnly: t("credit.packs.readOnly"),
    add: t("credit.packs.add"),
    empty: t("credit.packs.empty"),
    nameBn: t("credit.packs.nameBn"),
    nameEn: t("credit.packs.nameEn"),
    credits: t("credit.packs.credits"),
    price: t("credit.packs.price"),
    validityDays: t("credit.packs.validityDays"),
    validityHint: t("credit.packs.validityHint"),
    sortOrder: t("credit.packs.sortOrder"),
    sortOrderHint: t("credit.packs.sortOrderHint"),
    save: t("credit.packs.save"),
    archive: t("credit.packs.archive"),
    edit: t("credit.packs.edit"),
    close: t("credit.packs.close"),
    status: {
      ACTIVE: t("credit.packs.status.ACTIVE"),
      ARCHIVED: t("credit.packs.status.ARCHIVED"),
    },
    summary: t("credit.packs.summary"),
    expiresAfter: t("credit.packs.expiresAfter"),
    neverExpires: t("credit.packs.neverExpires"),
    invalid: t("credit.packs.invalid"),
    conflict: t("credit.packs.conflict"),
    reload: t("credit.packs.reload"),
  };
}

export function contactCreditsLabelsOf(t: Translator["t"]): ContactCreditsLabels {
  return {
    title: t("contacts.credits.title"),
    help: t("contacts.credits.help"),
    balance: t("contacts.credits.balance"),
    balanceValue: t("contacts.credits.balanceValue"),
    history: t("contacts.credits.history"),
    empty: t("contacts.credits.empty"),
    entry: {
      PURCHASE: t("contacts.credits.entry.PURCHASE"),
      SPEND: t("contacts.credits.entry.SPEND"),
      REFUND: t("contacts.credits.entry.REFUND"),
      EXPIRE: t("contacts.credits.entry.EXPIRE"),
      ADJUST: t("contacts.credits.entry.ADJUST"),
    },
    expiresOn: t("contacts.credits.expiresOn"),
    adjust: t("contacts.credits.adjust"),
    adjustCredits: t("contacts.credits.adjustCredits"),
    adjustHint: t("contacts.credits.adjustHint"),
    adjustReason: t("contacts.credits.adjustReason"),
    adjustSubmit: t("contacts.credits.adjustSubmit"),
    adjusted: t("contacts.credits.adjusted"),
    invalid: t("contacts.credits.invalid"),
    location: t("contacts.credits.location"),
    locationHelp: t("contacts.credits.locationHelp"),
    noLocations: t("contacts.credits.noLocations"),
    noApprovers: t("contacts.credits.noApprovers"),
    approval: {
      title: t("contacts.credits.approval.title"),
      approver: t("contacts.credits.approval.approver"),
      pin: t("contacts.credits.approval.pin"),
      submit: t("contacts.credits.approval.submit"),
      cancel: t("contacts.credits.approval.cancel"),
      close: t("contacts.credits.approval.close"),
      locked: t("contacts.credits.approval.locked"),
    },
  };
}

export function creditPaymentMethodsLabelsOf(t: Translator["t"]): CreditPaymentMethodsLabels {
  return {
    title: t("credit.paymentMethods.title"),
    help: t("credit.paymentMethods.help"),
    empty: t("credit.paymentMethods.empty"),
    add: t("credit.paymentMethods.add"),
    remove: t("credit.paymentMethods.remove"),
    method: t("credit.paymentMethods.method"),
    methodLabels: {
      BKASH: t("credit.purchases.method.BKASH"),
      NAGAD: t("credit.purchases.method.NAGAD"),
    },
    accountNumber: t("credit.paymentMethods.accountNumber"),
    accountType: t("credit.paymentMethods.accountType"),
    accountTypeHint: t("credit.paymentMethods.accountTypeHint"),
    instructionsBn: t("credit.paymentMethods.instructionsBn"),
    instructionsEn: t("credit.paymentMethods.instructionsEn"),
    save: t("credit.paymentMethods.save"),
    saved: t("credit.paymentMethods.saved"),
    invalid: t("credit.paymentMethods.invalid"),
    conflict: t("credit.purchases.conflict"),
    reload: t("credit.purchases.reload"),
  };
}
