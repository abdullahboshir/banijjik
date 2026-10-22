import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { PAYMENT_RULE_KEYS } from "@banijjik/contracts/payment";

export { DomainRuleError };

export function paymentReferenceTakenError(existingPaymentId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    details: {
      ruleKey: PAYMENT_RULE_KEYS.PAYMENT_REFERENCE_TAKEN,
      existingPaymentId,
    },
  });
}

export function depositRequiredError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.DEPOSIT_REQUIRED },
  });
}

export function paymentAllocationsInvalidError(message?: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_ALLOCATIONS_INVALID, message },
  });
}

export function paymentOverpaymentRequiresContactError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_OVERPAYMENT_REQUIRES_CONTACT },
  });
}

export function paymentRefundExceedsPaidError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_REFUND_EXCEEDS_PAID },
  });
}

export function paymentReversalAlreadyReversedError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_REVERSAL_ALREADY_REVERSED },
  });
}

export function paymentReversalHasRefundError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_REVERSAL_HAS_REFUND },
  });
}

export function overpaymentCreditSpentError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.OVERPAYMENT_CREDIT_SPENT },
  });
}

export function paymentContactNotFoundError(contactId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_CONTACT_NOT_FOUND, contactId },
  });
}

export function storeCreditConflictError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
  });
}

export function storeCreditInsufficientError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    details: { ruleKey: PAYMENT_RULE_KEYS.STORE_CREDIT_INSUFFICIENT },
  });
}

export function paymentMethodNotAllowedError(method: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_METHOD_NOT_ALLOWED, method },
  });
}

export function paymentRequestNotFoundError(requestId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_REQUEST_NOT_FOUND, requestId },
  });
}

export function paymentApprovalRequiredError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.APPROVAL_REQUIRED,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_APPROVAL_REQUIRED },
  });
}

export function paymentOriginalNotFoundError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.NOT_FOUND,
    details: { ruleKey: PAYMENT_RULE_KEYS.PAYMENT_ORIGINAL_NOT_FOUND },
  });
}

export function storeCreditContactRequiredError(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: PAYMENT_RULE_KEYS.STORE_CREDIT_CONTACT_REQUIRED },
  });
}

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}
