import type { CreditPurchaseMethod, CreditPurchaseStatus } from "@banijjik/contracts/credit";
import type { Translator } from "@banijjik/i18n";
import type { ContactCreditsApprovalLabels } from "./credit-labels";

/** All text of the purchase screens, translated on the server (the browser bundle has no screen catalog). */
export interface CreditPurchaseLabels {
  title: string;
  subtitle: string;
  readOnly: string;
  empty: string;
  filter: { status: string; statusAll: string; search: string; apply: string };
  status: Readonly<Record<CreditPurchaseStatus, string>>;
  method: Readonly<Record<CreditPurchaseMethod, string>>;
  card: {
    sender: string;
    reference: string;
    amount: string;
    pack: string;
    ageDays: string;
    ageHours: string;
    open: string;
  };
  page: { previous: string; next: string; current: string };
  detail: {
    title: string;
    close: string;
    copy: string;
    copied: string;
    method: string;
    credits: string;
    submittedAt: string;
    expiresAt: string;
    verifiedAt: string;
    rejectionReason: string;
  };
  verify: string;
  verified: string;
  reject: string;
  rejectReason: string;
  rejectSubmit: string;
  rejected: string;
  rejectReasonInvalid: string;
  /** Short reasons staff tap instead of typing. */
  reasons: readonly string[];
  conflict: string;
  reload: string;
  location: string;
  locationHelp: string;
  noApprovers: string;
  approval: ContactCreditsApprovalLabels;
}

type T = Translator["t"];

function cardLabelsOf(t: T): CreditPurchaseLabels["card"] {
  return {
    sender: t("credit.purchases.card.sender"),
    reference: t("credit.purchases.card.reference"),
    amount: t("credit.purchases.card.amount"),
    pack: t("credit.purchases.card.pack"),
    ageDays: t("credit.purchases.card.ageDays"),
    ageHours: t("credit.purchases.card.ageHours"),
    open: t("credit.purchases.card.open"),
  };
}

function detailLabelsOf(t: T): CreditPurchaseLabels["detail"] {
  return {
    title: t("credit.purchases.detail.title"),
    close: t("credit.purchases.detail.close"),
    copy: t("credit.purchases.detail.copy"),
    copied: t("credit.purchases.detail.copied"),
    method: t("credit.purchases.detail.method"),
    credits: t("credit.purchases.detail.credits"),
    submittedAt: t("credit.purchases.detail.submittedAt"),
    expiresAt: t("credit.purchases.detail.expiresAt"),
    verifiedAt: t("credit.purchases.detail.verifiedAt"),
    rejectionReason: t("credit.purchases.detail.rejectionReason"),
  };
}

/** The approval PIN dialog and its location field read the same text as the credit adjustment. */
function approvalLabelsOf(t: T): ContactCreditsApprovalLabels {
  return {
    title: t("contacts.credits.approval.title"),
    approver: t("contacts.credits.approval.approver"),
    pin: t("contacts.credits.approval.pin"),
    submit: t("contacts.credits.approval.submit"),
    cancel: t("contacts.credits.approval.cancel"),
    close: t("contacts.credits.approval.close"),
    locked: t("contacts.credits.approval.locked"),
  };
}

function listLabelsOf(t: T): Pick<CreditPurchaseLabels, "filter" | "status" | "method" | "page"> {
  return {
    filter: {
      status: t("credit.purchases.filter.status"),
      statusAll: t("credit.purchases.filter.statusAll"),
      search: t("credit.purchases.filter.search"),
      apply: t("credit.purchases.filter.apply"),
    },
    status: {
      PENDING: t("credit.purchases.status.PENDING"),
      VERIFIED: t("credit.purchases.status.VERIFIED"),
      REJECTED: t("credit.purchases.status.REJECTED"),
      CANCELLED: t("credit.purchases.status.CANCELLED"),
    },
    method: {
      BKASH: t("credit.purchases.method.BKASH"),
      NAGAD: t("credit.purchases.method.NAGAD"),
    },
    page: {
      previous: t("credit.purchases.page.previous"),
      next: t("credit.purchases.page.next"),
      current: t("credit.purchases.page.current"),
    },
  };
}

export function creditPurchaseLabelsOf(t: T): CreditPurchaseLabels {
  return {
    ...listLabelsOf(t),
    title: t("credit.purchases.title"),
    subtitle: t("credit.purchases.subtitle"),
    readOnly: t("credit.purchases.readOnly"),
    empty: t("credit.purchases.empty"),
    card: cardLabelsOf(t),
    detail: detailLabelsOf(t),
    verify: t("credit.purchases.verify"),
    verified: t("credit.purchases.verified"),
    reject: t("credit.purchases.reject"),
    rejectReason: t("credit.purchases.rejectReason"),
    rejectSubmit: t("credit.purchases.rejectSubmit"),
    rejected: t("credit.purchases.rejected"),
    rejectReasonInvalid: t("credit.purchases.rejectReasonInvalid"),
    reasons: [
      t("credit.purchases.reasons.notFound"),
      t("credit.purchases.reasons.amountMismatch"),
      t("credit.purchases.reasons.senderMismatch"),
    ],
    conflict: t("credit.purchases.conflict"),
    reload: t("credit.purchases.reload"),
    location: t("contacts.credits.location"),
    locationHelp: t("contacts.credits.locationHelp"),
    noApprovers: t("contacts.credits.noApprovers"),
    approval: approvalLabelsOf(t),
  };
}
