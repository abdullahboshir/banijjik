import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../../kernel/http/index.js";

export function consignmentNotFound(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.consignment_not_found",
  });
}

export function duplicateTrackingNumber(courierKey: string, trackingNumber: string): AppError {
  return new AppError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.duplicate_tracking_number",
    details: { courierKey, trackingNumber },
  });
}

export function courierSettlementNotFound(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.courier_settlement_not_found",
  });
}

export function settlementAlreadyReversed(courierSettlementId: string): AppError {
  return new AppError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.settlement_already_reversed",
    details: { courierSettlementId },
  });
}

export function invalidSettlementGross(expected: number, actual: number): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.invalid_settlement_gross",
    details: { expected, actual },
  });
}

export function settlementChargesExceedGross(charges: number, gross: number): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.settlement_charges_exceed_gross",
    details: { charges, gross },
  });
}

export function paymentNotEligibleForSettlement(paymentId: string, reason: string): AppError {
  return new AppError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.payment_not_eligible_for_settlement",
    details: { paymentId, reason },
  });
}
