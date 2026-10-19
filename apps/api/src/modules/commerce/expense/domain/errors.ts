import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { EXPENSE_RULE_KEY } from "@banijjik/contracts/accounting";

export { DomainRuleError };

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

export function attachmentRequired(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: `errors.expense.${EXPENSE_RULE_KEY.attachment_required}`,
    details: { ruleKey: EXPENSE_RULE_KEY.attachment_required },
  });
}

export function tooManyAttachments(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: `errors.expense.${EXPENSE_RULE_KEY.too_many_attachments}`,
    details: { ruleKey: EXPENSE_RULE_KEY.too_many_attachments },
  });
}

export function invalidAttachment(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: `errors.expense.${EXPENSE_RULE_KEY.invalid_attachment}`,
    details: { ruleKey: EXPENSE_RULE_KEY.invalid_attachment },
  });
}

export function categoryArchived(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: `errors.expense.${EXPENSE_RULE_KEY.category_archived}`,
    details: { ruleKey: EXPENSE_RULE_KEY.category_archived },
  });
}

export function alreadyVoided(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    messageKey: `errors.expense.${EXPENSE_RULE_KEY.already_voided}`,
    details: { ruleKey: EXPENSE_RULE_KEY.already_voided },
  });
}

export function versionConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.version_conflict" });
}
