import type { Translator } from "@banijjik/i18n";

export interface PosTillLabels {
  readonly hold: string;
  readonly holdLabel: string;
  readonly holdSubmit: string;
  readonly held: string;
  readonly noHeld: string;
  readonly resume: string;
  readonly replaceConfirm: string;
  readonly limit: string;
  readonly price: string;
  readonly unitPrice: string;
  readonly listPrice: string;
  readonly overrideTotal: string;
  readonly listTotal: string;
  readonly applyPrice: string;
  readonly approver: string;
  readonly pin: string;
  readonly approvalSubmit: string;
  readonly approvalCancel: string;
  readonly approvalClose: string;
  readonly approvalLocked: string;
  readonly noApprovers: string;
  readonly approvalFailed: string;
  readonly quoteFailed: string;
  readonly return: string;
  readonly orderSearch: string;
  readonly findOrder: string;
  readonly noOrders: string;
  readonly returnQuantity: string;
  readonly refundAmount: string;
  readonly returnSubmit: string;
  readonly returnSuccess: string;
  readonly returnFailed: string;
  readonly returnSelect: string;
  readonly returnReason: string;
  readonly returnReasonChangedMind: string;
  readonly returnReasonDefective: string;
  readonly returnReasonWrongItem: string;
  readonly returnReasonNotAsDescribed: string;
  readonly returnReasonNotDelivered: string;
  readonly returnReasonOther: string;
  readonly returnNote: string;
}

export function tillLabelsOf(t: Translator["t"]): PosTillLabels {
  return {
    hold: t("pos.till.hold"),
    holdLabel: t("pos.till.holdLabel"),
    holdSubmit: t("pos.till.holdSubmit"),
    held: t("pos.till.held"),
    noHeld: t("pos.till.noHeld"),
    resume: t("pos.till.resume"),
    replaceConfirm: t("pos.till.replaceConfirm"),
    limit: t("pos.till.limit"),
    price: t("pos.till.price"),
    unitPrice: t("pos.till.unitPrice"),
    listPrice: t("pos.till.listPrice"),
    overrideTotal: t("pos.till.overrideTotal"),
    listTotal: t("pos.till.listTotal"),
    applyPrice: t("pos.till.applyPrice"),
    approver: t("pos.till.approver"),
    pin: t("pos.till.pin"),
    approvalSubmit: t("pos.till.approvalSubmit"),
    approvalCancel: t("pos.till.approvalCancel"),
    approvalClose: t("pos.till.approvalClose"),
    approvalLocked: t("pos.till.approvalLocked"),
    noApprovers: t("pos.till.noApprovers"),
    approvalFailed: t("pos.till.approvalFailed"),
    quoteFailed: t("pos.till.quoteFailed"),
    return: t("pos.till.return"),
    orderSearch: t("pos.till.orderSearch"),
    findOrder: t("pos.till.findOrder"),
    noOrders: t("pos.till.noOrders"),
    returnQuantity: t("pos.till.returnQuantity"),
    refundAmount: t("pos.till.refundAmount"),
    returnSubmit: t("pos.till.returnSubmit"),
    returnSuccess: t("pos.till.returnSuccess"),
    returnFailed: t("pos.till.returnFailed"),
    returnSelect: t("pos.till.returnSelect"),
    returnReason: t("pos.till.returnReason"),
    returnReasonChangedMind: t("pos.till.returnReason.CHANGED_MIND"),
    returnReasonDefective: t("pos.till.returnReason.DEFECTIVE"),
    returnReasonWrongItem: t("pos.till.returnReason.WRONG_ITEM"),
    returnReasonNotAsDescribed: t("pos.till.returnReason.NOT_AS_DESCRIBED"),
    returnReasonNotDelivered: t("pos.till.returnReason.NOT_DELIVERED"),
    returnReasonOther: t("pos.till.returnReason.OTHER"),
    returnNote: t("pos.till.returnNote"),
  };
}
