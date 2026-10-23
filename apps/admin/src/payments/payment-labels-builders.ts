import type { Translator } from "@banijjik/i18n";
import type { PaymentLabels } from "./payment-labels";

type T = Translator["t"];

export function buildDetailLabels(t: T): PaymentLabels["detail"] {
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

export function buildReceiveSheetLabels(t: T): PaymentLabels["receiveSheet"] {
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
    amountInvalid: t("payments.receive.amountInvalid"),
    locationRequired: t("payments.receive.locationRequired"),
    failed: t("payments.receive.failed"),
    conflict: t("payments.receive.conflict"),
    reload: t("payments.receive.reload"),
  };
}

export function buildDialogLabels(t: T): Pick<PaymentLabels, "refundDialog" | "reversalDialog"> {
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
      failed: t("payments.refund.failed"),
      approvalFailed: t("payments.refund.approvalFailed"),
      loadApproversFailed: t("payments.refund.loadApproversFailed"),
      approvalTitle: t("payments.refund.approvalTitle"),
      approver: t("payments.refund.approver"),
      pin: t("payments.refund.pin"),
      noApprovers: t("payments.refund.noApprovers"),
      approvalLocked: t("approval.dialog.locked"),
    },
    reversalDialog: {
      title: t("payments.reverse.title"),
      warning: t("payments.reverse.warning"),
      note: t("payments.reverse.note"),
      submit: t("payments.reverse.submit"),
      cancel: t("payments.reverse.cancel"),
      success: t("payments.reverse.success"),
      failed: t("payments.reverse.failed"),
      loadApproversFailed: t("payments.reverse.loadApproversFailed"),
      conflict: t("payments.reverse.conflict"),
      reload: t("payments.reverse.reload"),
      approvalTitle: t("payments.reverse.title"),
      approver: t("payments.refund.approver"),
      pin: t("payments.refund.pin"),
      noApprovers: t("payments.refund.noApprovers"),
      approvalLocked: t("approval.dialog.locked"),
    },
  };
}

export function buildCoreEnums(
  t: T,
): Pick<PaymentLabels, "method" | "direction" | "status" | "card" | "filter" | "requestType"> {
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
    requestType: {
      BOOKING: t("payments.requestType.BOOKING"),
      ORDER: t("payments.requestType.ORDER"),
      ENROLLMENT: t("payments.requestType.ENROLLMENT"),
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
