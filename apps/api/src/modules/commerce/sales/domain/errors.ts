import {
  DomainRuleError,
  ERROR_CODE,
  type ErrorCode,
  type OfferingKind,
} from "@banijjik/contracts";
import { SALES_RULE_KEY, type SalesRuleKey } from "@banijjik/contracts/sales";

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

export function salesRuleError(
  ruleKey: SalesRuleKey,
  code: ErrorCode = ERROR_CODE.BUSINESS_RULE,
  details: Readonly<Record<string, unknown>> = {},
): DomainRuleError {
  return new DomainRuleError({ code, details: { ruleKey, ...details } });
}

/** A SERVICE, PLAN, RENTAL or EVENT line belongs to bookings, enrollments or events (11 §5.5). */
export function kindNeedsBooking(input: {
  readonly offeringId: string;
  readonly kind: OfferingKind;
}): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.KIND_NEEDS_BOOKING, ERROR_CODE.BUSINESS_RULE, input);
}

export function fulfillmentMethodUnsupported(method: string): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED, ERROR_CODE.BUSINESS_RULE, {
    method,
  });
}

export function advanceNeedsPayments(): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.ADVANCE_NEEDS_PAYMENTS);
}

/** A pickup order needs a contact with a phone, so the shop can call when it is ready. */
export function contactPhoneRequired(contactId: string): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.CONTACT_PHONE_REQUIRED, ERROR_CODE.BUSINESS_RULE, {
    contactId,
  });
}
