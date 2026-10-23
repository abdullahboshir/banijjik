import type {
  PaymentDirection,
  PaymentMethod,
  PaymentRequestType,
  PaymentStatus,
} from "@banijjik/contracts/payment";
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
  readonly requestType: Readonly<Record<PaymentRequestType, string>>;
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
    readonly amountInvalid: string;
    readonly locationRequired: string;
    readonly failed: string;
    readonly conflict: string;
    readonly reload: string;
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
    readonly failed: string;
    readonly approvalFailed: string;
    readonly loadApproversFailed: string;
    readonly approvalTitle: string;
    readonly approver: string;
    readonly pin: string;
    readonly noApprovers: string;
    readonly approvalLocked: string;
  };
  readonly reversalDialog: {
    readonly title: string;
    readonly warning: string;
    readonly note: string;
    readonly submit: string;
    readonly cancel: string;
    readonly success: string;
    readonly failed: string;
    readonly loadApproversFailed: string;
    readonly conflict: string;
    readonly reload: string;
    readonly approvalTitle: string;
    readonly approver: string;
    readonly pin: string;
    readonly noApprovers: string;
    readonly approvalLocked: string;
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

import {
  buildCoreEnums,
  buildDetailLabels,
  buildDialogLabels,
  buildReceiveSheetLabels,
} from "./payment-labels-builders";

type T = Translator["t"];

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
