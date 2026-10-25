import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { POS_API_MESSAGE_KEYS, POS_RULE_KEY, type PosRuleKey } from "@banijjik/contracts/pos";

export { DomainRuleError };

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

export function forbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN });
}

/** A rare collision (two devices drew the same pairing code at once): the client simply asks again. */
export function retryableConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.CONFLICT });
}

/** One generic answer for a wrong, expired or used code, so a guess learns nothing (plan decision 2). */
export function pairingInvalid(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: POS_API_MESSAGE_KEYS.pairingInvalid,
  });
}

export function deviceRequired(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.FORBIDDEN,
    messageKey: POS_API_MESSAGE_KEYS.deviceRequired,
  });
}

export function sessionAlreadyOpen(posSessionId: string | null): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: POS_API_MESSAGE_KEYS.sessionAlreadyOpen,
    ...(posSessionId === null ? {} : { details: { posSessionId } }),
  });
}

export function sessionRequired(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: POS_API_MESSAGE_KEYS.sessionRequired,
  });
}

export function sessionClosed(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    messageKey: POS_API_MESSAGE_KEYS.sessionClosed,
    details: { currentStatus: "CLOSED" },
  });
}

const RULE_MESSAGE_KEY: Readonly<Record<PosRuleKey, string>> = {
  [POS_RULE_KEY.PAYMENT_SHORT]: POS_API_MESSAGE_KEYS.paymentShort,
  [POS_RULE_KEY.OVERPAYMENT_NOT_CASH]: POS_API_MESSAGE_KEYS.overpaymentNotCash,
  [POS_RULE_KEY.CASH_TENDERED_INVALID]: POS_API_MESSAGE_KEYS.cashTenderedInvalid,
  [POS_RULE_KEY.TENDER_REQUIRED]: POS_API_MESSAGE_KEYS.tenderRequired,
  [POS_RULE_KEY.CURRENCY_MISMATCH]: POS_API_MESSAGE_KEYS.currencyMismatch,
};

/** A tender rule that failed: 422 with the rule key in `details` and its own message key. */
export function posRuleError(
  ruleKey: PosRuleKey,
  details: Readonly<Record<string, unknown>> = {},
): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: RULE_MESSAGE_KEY[ruleKey],
    details: { ruleKey, ...details },
  });
}
