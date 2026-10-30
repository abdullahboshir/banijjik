import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { BOOKING_RULE_KEY, EVENT_SESSION_RULE_KEY } from "@banijjik/contracts/booking";
import type { ResourceId } from "@banijjik/ids";

export { DomainRuleError };

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

export function holdExpiredError(): DomainRuleError {
  return bookingRuleError(BOOKING_RULE_KEY.HOLD_EXPIRED);
}

export function slotUnavailableError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.SLOT_UNAVAILABLE,
    details: { ruleKey: BOOKING_RULE_KEY.SLOT_UNAVAILABLE },
  });
}
export function eventSessionResourceBusyError(resourceId?: ResourceId): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.SLOT_UNAVAILABLE,
    details: {
      ruleKey: EVENT_SESSION_RULE_KEY.RESOURCE_BUSY,
      ...(resourceId === undefined ? {} : { resourceId }),
    },
  });
}

export function capacityFullError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CAPACITY_FULL,
    details: { ruleKey: BOOKING_RULE_KEY.SLOT_UNAVAILABLE },
  });
}

/** A full session answers like a full slot: 409, with the sold-out rule. */
export function eventSoldOutError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.SLOT_UNAVAILABLE,
    details: { ruleKey: BOOKING_RULE_KEY.BOOKING_EVENT_SOLD_OUT },
  });
}

export function depositRequiredError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: "errors.deposit_required" },
  });
}

export function bookingRuleError(
  ruleKey: (typeof BOOKING_RULE_KEY)[keyof typeof BOOKING_RULE_KEY],
  code: (typeof ERROR_CODE)[keyof typeof ERROR_CODE] = ERROR_CODE.BUSINESS_RULE,
): DomainRuleError {
  return new DomainRuleError({ code, details: { ruleKey } });
}

export function bookingHoldExpired(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.BOOKING_HOLD_EXPIRED });
}

export function bookingPaymentFenceConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.BOOKING_PAYMENT_FENCE_CONFLICT });
}
