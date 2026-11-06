import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../../kernel/http/index.js";

export function deliveryFulfillmentMismatch(): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.delivery_fulfillment_mismatch",
  });
}

export function riderNotAssignedToLocation(riderMemberId: string): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.rider_not_assigned_to_location",
    details: { riderMemberId },
  });
}

export function riderCannotApproveOwnHandover(): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.rider_cannot_approve_own_handover",
  });
}

export function handoverAlreadyReversed(riderCashHandoverId: string): AppError {
  return new AppError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.handover_already_reversed",
    details: { riderCashHandoverId },
  });
}

export function paymentNotEligibleForHandover(paymentId: string, reason: string): AppError {
  return new AppError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "errors.payment_not_eligible_for_handover",
    details: { paymentId, reason },
  });
}
