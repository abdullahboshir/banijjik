import type { PaymentDirection, PaymentMethod, PaymentStatus } from "@banijjik/contracts/payment";
import type { Translator } from "@banijjik/i18n";

export interface PaymentLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly readOnly: string;
  readonly empty: string;
  readonly receive: string;
  readonly duesLink: string;
  readonly pagination: {
    readonly previous: string;
    readonly next: string;
    readonly total: string;
  };
  readonly filter: {
    readonly method: string;
    readonly methodAll: string;
    readonly direction: string;
    readonly directionAll: string;
    readonly location: string;
    readonly locationAll: string;
    readonly from: string;
    readonly to: string;
    readonly apply: string;
    readonly reset: string;
  };
  readonly method: Readonly<Record<PaymentMethod, string>>;
  readonly direction: Readonly<Record<PaymentDirection, string>>;
  readonly status: Readonly<Record<PaymentStatus, string>>;
  readonly card: {
    readonly number: string;
    readonly amount: string;
    readonly date: string;
    readonly method: string;
    readonly location: string;
    readonly reference: string;
    readonly open: string;
  };
  readonly detail: {
    readonly title: string;
    readonly overview: string;
    readonly noAllocations: string;
    readonly back: string;
    readonly paymentNumber: string;
    readonly amount: string;
    readonly direction: string;
    readonly method: string;
    readonly businessDate: string;
    readonly location: string;
    readonly contact: string;
    readonly reference: string;
    readonly reversesPayment: string;
    readonly allocations: string;
    readonly allocationRequest: string;
    readonly allocationAmount: string;
    readonly revenueState: string;
    readonly revenueStates: {
      readonly BEFORE_REVENUE: string;
      readonly AFTER_REVENUE: string;
    };
    readonly approval: string;
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly note: string;
    readonly refund: string;
    readonly reverse: string;
  };
  readonly receiveSheet: {
    readonly title: string;
    readonly amount: string;
    readonly method: string;
    readonly location: string;
    readonly contact: string;
    readonly contactPlaceholder: string;
    readonly reference: string;
    readonly referenceRequired: string;
    readonly referencePlaceholder: string;
    readonly businessNumberNotice: string;
    readonly allocations: string;
    readonly allocatedAmount: string;
    readonly due: string;
    readonly overpaymentCreditNotice: string;
    readonly overpaymentCashNotice: string;
    readonly overpaymentError: string;
    readonly note: string;
    readonly submit: string;
    readonly cancel: string;
    readonly success: string;
  };
  readonly refundDialog: {
    readonly title: string;
    readonly allocations: string;
    readonly amount: string;
    readonly method: string;
    readonly reference: string;
    readonly note: string;
    readonly submit: string;
    readonly cancel: string;
    readonly success: string;
    readonly approvalTitle: string;
    readonly approver: string;
    readonly pin: string;
    readonly noApprovers: string;
  };
  readonly reversalDialog: {
    readonly title: string;
    readonly warning: string;
    readonly note: string;
    readonly submit: string;
    readonly cancel: string;
    readonly success: string;
    readonly conflict: string;
    readonly reload: string;
    readonly approvalTitle: string;
    readonly approver: string;
    readonly pin: string;
    readonly noApprovers: string;
  };
  readonly settings: {
    readonly title: string;
    readonly help: string;
    readonly empty: string;
    readonly save: string;
    readonly saved: string;
    readonly conflict: string;
    readonly invalid: string;
  };
}

type T = Translator["t"];

function buildDetailLabels(t: T): PaymentLabels["detail"] {
  return {
    title: t("payments.detail.title"),
    overview: t("payments.detail.overview"),
    noAllocations: t("payments.detail.noAllocations"),
    back: t("payments.detail.back"),
    paymentNumber: t("payments.detail.paymentNumber"),
    amount: t("payments.detail.amount"),
    direction: t("payments.detail.direction"),
    method: t("payments.detail.method"),
    businessDate: t("payments.detail.businessDate"),
    location: t("payments.detail.location"),
    contact: t("payments.detail.contact"),
    reference: t("payments.detail.reference"),
    reversesPayment: t("payments.detail.reversesPayment"),
    allocations: t("payments.detail.allocations"),
    allocationRequest: t("payments.detail.allocationRequest"),
    allocationAmount: t("payments.detail.allocationAmount"),
    revenueState: t("payments.detail.revenueState"),
    revenueStates: {
      BEFORE_REVENUE: t("payments.detail.revenueState.BEFORE_REVENUE"),
      AFTER_REVENUE: t("payments.detail.revenueState.AFTER_REVENUE"),
    },
    approval: t("payments.detail.approval"),
    approvedBy: t("payments.detail.approvedBy"),
    approvedAt: t("payments.detail.approvedAt"),
    note: t("payments.detail.note"),
    refund: t("payments.detail.refund"),
    reverse: t("payments.detail.reverse"),
  };
}

function buildReceiveSheetLabels(t: T): PaymentLabels["receiveSheet"] {
  return {
    title: t("payments.receive.title"),
    amount: t("payments.receive.amount"),
    method: t("payments.receive.method"),
    location: t("payments.receive.location"),
    contact: t("payments.receive.contact"),
    contactPlaceholder: t("payments.receive.contactPlaceholder"),
    reference: t("payments.receive.reference"),
    referenceRequired: t("payments.receive.referenceRequired"),
    referencePlaceholder: t("payments.receive.referencePlaceholder"),
    businessNumberNotice: t("payments.receive.businessNumberNotice"),
    allocations: t("payments.receive.allocations"),
    allocatedAmount: t("payments.receive.allocatedAmount"),
    due: t("payments.receive.due"),
    overpaymentCreditNotice: t("payments.receive.overpaymentCreditNotice"),
    overpaymentCashNotice: t("payments.receive.overpaymentCashNotice"),
    overpaymentError: t("payments.receive.overpaymentError"),
    note: t("payments.receive.note"),
    submit: t("payments.receive.submit"),
    cancel: t("payments.receive.cancel"),
    success: t("payments.receive.success"),
  };
}

function buildDialogLabels(t: T): Pick<PaymentLabels, "refundDialog" | "reversalDialog"> {
  return {
    refundDialog: {
      title: t("payments.refund.title"),
      allocations: t("payments.refund.allocations"),
      amount: t("payments.refund.amount"),
      method: t("payments.refund.method"),
      reference: t("payments.refund.reference"),
      note: t("payments.refund.note"),
      submit: t("payments.refund.submit"),
      cancel: t("payments.refund.cancel"),
      success: t("payments.refund.success"),
      approvalTitle: t("payments.refund.approvalTitle"),
      approver: t("payments.refund.approver"),
      pin: t("payments.refund.pin"),
      noApprovers: t("payments.refund.noApprovers"),
    },
    reversalDialog: {
      title: t("payments.reverse.title"),
      warning: t("payments.reverse.warning"),
      note: t("payments.reverse.note"),
      submit: t("payments.reverse.submit"),
      cancel: t("payments.reverse.cancel"),
      success: t("payments.reverse.success"),
      conflict: t("payments.reverse.conflict"),
      reload: t("payments.reverse.reload"),
      approvalTitle: t("payments.reverse.title"),
      approver: t("payments.refund.approver"),
      pin: t("payments.refund.pin"),
      noApprovers: t("payments.refund.noApprovers"),
    },
  };
}

function buildCoreEnums(
  t: T,
): Pick<PaymentLabels, "method" | "direction" | "status" | "card" | "filter"> {
  return {
    filter: {
      method: t("payments.filter.method"),
      methodAll: t("payments.filter.methodAll"),
      direction: t("payments.filter.direction"),
      directionAll: t("payments.filter.directionAll"),
      location: t("payments.filter.location"),
      locationAll: t("payments.filter.locationAll"),
      from: t("payments.filter.from"),
      to: t("payments.filter.to"),
      apply: t("payments.filter.apply"),
      reset: t("payments.filter.reset"),
    },
    method: {
      CASH: t("payments.method.CASH"),
      BKASH: t("payments.method.BKASH"),
      NAGAD: t("payments.method.NAGAD"),
      BANK: t("payments.method.BANK"),
      CARD: t("payments.method.CARD"),
      STORE_CREDIT: t("payments.method.STORE_CREDIT"),
      GATEWAY: t("payments.method.GATEWAY"),
      COD_COURIER: t("payments.method.COD_COURIER"),
      RIDER_CASH: t("payments.method.RIDER_CASH"),
    },
    direction: {
      IN: t("payments.direction.IN"),
      REFUND: t("payments.direction.REFUND"),
      REVERSAL: t("payments.direction.REVERSAL"),
    },
    status: {
      UNPAID: t("payments.status.UNPAID"),
      PARTIAL: t("payments.status.PARTIAL"),
      PAID: t("payments.status.PAID"),
      REFUNDED: t("payments.status.REFUNDED"),
    },
    card: {
      number: t("payments.card.number"),
      amount: t("payments.card.amount"),
      date: t("payments.card.date"),
      method: t("payments.card.method"),
      location: t("payments.card.location"),
      reference: t("payments.card.reference"),
      open: t("payments.card.open"),
    },
  };
}

export function paymentLabelsOf(t: T): PaymentLabels {
  const dialogs = buildDialogLabels(t);
  const core = buildCoreEnums(t);
  return {
    title: t("payments.title"),
    subtitle: t("payments.subtitle"),
    readOnly: t("payments.readOnly"),
    empty: t("payments.empty"),
    receive: t("payments.receive"),
    duesLink: t("payments.duesLink"),
    pagination: {
      previous: t("payments.page.previous"),
      next: t("payments.page.next"),
      total: t("payments.page.total"),
    },
    ...core,
    detail: buildDetailLabels(t),
    receiveSheet: buildReceiveSheetLabels(t),
    refundDialog: dialogs.refundDialog,
    reversalDialog: dialogs.reversalDialog,
    settings: {
      title: t("payments.settings.title"),
      help: t("payments.settings.help"),
      empty: t("payments.settings.empty"),
      save: t("payments.settings.save"),
      saved: t("payments.settings.saved"),
      conflict: t("payments.settings.conflict"),
      invalid: t("payments.settings.invalid"),
    },
  };
}
