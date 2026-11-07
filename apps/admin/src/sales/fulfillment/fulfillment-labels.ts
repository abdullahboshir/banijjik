import type { T } from "../order-label-enums";
import type {
  DeliveryAttemptLabels,
  DeliveryAttemptsCardLabels,
  DeliveryLossLabels,
  OrderRtsLabels,
  OrderShipLabels,
} from "../order-label-types";

export function shipLabelsOf(t: T): OrderShipLabels {
  return {
    title: t("orders.ship.title"),
    reshipTitle: t("orders.ship.reshipTitle"),
    method: t("orders.ship.method"),
    courier: t("orders.ship.courier"),
    rider: t("orders.ship.rider"),
    consignmentId: t("orders.ship.consignmentId"),
    consignmentPlaceholder: t("orders.ship.consignmentPlaceholder"),
    assignmentId: t("orders.ship.assignmentId"),
    assignmentPlaceholder: t("orders.ship.assignmentPlaceholder"),
    submit: t("orders.ship.submit"),
    reshipSubmit: t("orders.ship.reshipSubmit"),
    success: t("orders.ship.success"),
    reshipSuccess: t("orders.ship.reshipSuccess"),
  };
}

export function attemptLabelsOf(t: T): DeliveryAttemptLabels {
  return {
    title: t("orders.attempt.title"),
    reason: t("orders.attempt.reason"),
    reasonPlaceholder: t("orders.attempt.reasonPlaceholder"),
    reasons: {
      customerUnreachable: t("orders.attempt.reasons.customerUnreachable"),
      incorrectAddress: t("orders.attempt.reasons.incorrectAddress"),
      customerRescheduled: t("orders.attempt.reasons.customerRescheduled"),
      cashNotReady: t("orders.attempt.reasons.cashNotReady"),
      other: t("orders.attempt.reasons.other"),
    },
    note: t("orders.attempt.note"),
    notePlaceholder: t("orders.attempt.notePlaceholder"),
    submit: t("orders.attempt.submit"),
    success: t("orders.attempt.success"),
  };
}

export function rtsLabelsOf(t: T): OrderRtsLabels {
  return {
    title: t("orders.rts.title"),
    description: t("orders.rts.description"),
    reason: t("orders.rts.reason"),
    disposition: t("orders.rts.disposition"),
    restock: t("orders.rts.restock"),
    damaged: t("orders.rts.damaged"),
    submit: t("orders.rts.submit"),
    success: t("orders.rts.success"),
  };
}

export function lossLabelsOf(t: T): DeliveryLossLabels {
  return {
    closeTitle: t("orders.loss.closeTitle"),
    closeDescription: t("orders.loss.closeDescription"),
    recoverTitle: t("orders.loss.recoverTitle"),
    recoverDescription: t("orders.loss.recoverDescription"),
    lost: t("orders.loss.lost"),
    restock: t("orders.loss.restock"),
    damaged: t("orders.loss.damaged"),
    submitClose: t("orders.loss.submitClose"),
    submitRecover: t("orders.loss.submitRecover"),
    successClose: t("orders.loss.successClose"),
    successRecover: t("orders.loss.successRecover"),
  };
}

export function attemptsCardLabelsOf(t: T): DeliveryAttemptsCardLabels {
  return {
    title: t("orders.attempts.title"),
    empty: t("orders.attempts.empty"),
    ordinal: t("orders.attempts.ordinal"),
    started: t("orders.attempts.started"),
    failed: t("orders.attempts.failed"),
    method: t("orders.attempts.method"),
  };
}
