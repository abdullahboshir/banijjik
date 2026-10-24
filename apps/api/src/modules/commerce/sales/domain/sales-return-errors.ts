import { ERROR_CODE } from "@banijjik/contracts";
import type { ApprovalAction } from "@banijjik/contracts/iam";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { DomainRuleError, salesRuleError } from "./errors.js";

export function returnWindowClosed(): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.SALES_RETURN_WINDOW_CLOSED);
}

export function orderNotReturnable(status: string): DomainRuleError {
  return salesRuleError(
    SALES_RULE_KEY.SALES_RETURN_ORDER_NOT_RETURNABLE,
    ERROR_CODE.BUSINESS_RULE,
    {
      status,
    },
  );
}

export function quantityAboveSold(orderLineId: string): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.SALES_RETURN_QUANTITY_ABOVE_SOLD, ERROR_CODE.BUSINESS_RULE, {
    orderLineId,
  });
}

export function refundMethodRequired(): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.SALES_RETURN_REFUND_METHOD_REQUIRED);
}

export function paymentMethodNotAvailable(method: string): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.PAYMENT_METHOD_NOT_AVAILABLE, ERROR_CODE.BUSINESS_RULE, {
    method,
  });
}

export function otherReasonNeedsNote(): DomainRuleError {
  return salesRuleError(SALES_RULE_KEY.SALES_RETURN_OTHER_REASON_NEEDS_NOTE);
}

export function duplicateReturnLine(orderLineId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "errors.sales_return_duplicate_line",
    details: { orderLineId },
  });
}

/** A refund approval or a not-received approval is missing; the action says which one. */
export function returnApprovalRequired(action: ApprovalAction): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.APPROVAL_REQUIRED,
    messageKey: "errors.approval_required",
    details: { action },
  });
}
