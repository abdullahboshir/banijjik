import { DomainRuleError, ERROR_CODE, ORGANIZATION_RULE_KEY } from "@banijjik/contracts";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

/** Several field-level failures at once, in the same shape as the schema errors (14-API.md section 3). */
export function invalidFields(
  fields: readonly { readonly path: string; readonly messageKey: string }[],
): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, details: { fields } });
}

/** The slug already belongs to an organization, or was taken a moment ago by a concurrent request. */
export class SlugTakenError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "slug" } });
    this.name = "SlugTakenError";
  }
}

/** The caller has no usable account any more, e.g. a valid token for a deleted user. */
export function sessionNotValid(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.UNAUTHENTICATED });
}

/** No such record in this organization; a record of another organization looks the same (ADR-080). */
export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The transition is not allowed from the current status. */
export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

/** A unique value (location name, a member's account) is already taken. */
export class DuplicateFieldError extends DomainRuleError {
  constructor(readonly field: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field } });
    this.name = "DuplicateFieldError";
  }
}

function businessRule(ruleKey: string, messageKey: string, details?: object): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey,
    details: { ruleKey, ...details },
  });
}

export function locationIsDefault(): DomainRuleError {
  return businessRule(ORGANIZATION_RULE_KEY.LOCATION_IS_DEFAULT, "errors.location_is_default");
}

/** An ACTIVE member or a pending invitation still names the location. */
export function locationInUse(): DomainRuleError {
  return businessRule(ORGANIZATION_RULE_KEY.LOCATION_IN_USE, "errors.location_in_use");
}

export function ownerIsProtected(): DomainRuleError {
  return businessRule(ORGANIZATION_RULE_KEY.OWNER_IS_PROTECTED, "errors.owner_is_protected");
}

export function cannotChangeSelf(): DomainRuleError {
  return businessRule(ORGANIZATION_RULE_KEY.CANNOT_CHANGE_SELF, "errors.cannot_change_self");
}

/** The role is unknown, archived, the owner role, or holds a permission the caller lacks. */
export function roleNotGrantable(roleId: string): DomainRuleError {
  return businessRule(ORGANIZATION_RULE_KEY.ROLE_NOT_GRANTABLE, "errors.role_not_grantable", {
    roleId,
  });
}

/** A suspended member's location or role was archived meanwhile; fix the assignments first (09 section 4.4). */
export function memberAssignmentsInvalid(): DomainRuleError {
  return businessRule(
    ORGANIZATION_RULE_KEY.MEMBER_ASSIGNMENTS_INVALID,
    "errors.member_assignments_invalid",
  );
}

/** The signed-in user's email or phone number is not the one the invitation was sent to. */
export function invitationIdentifierMismatch(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.FORBIDDEN,
    messageKey: "errors.invitation_identifier_mismatch",
  });
}

/** The template is unknown, still a draft, or retired, so signup cannot choose it (ADR-075). */
export function industryTemplateNotAvailable(): DomainRuleError {
  return businessRule(
    ORGANIZATION_RULE_KEY.INDUSTRY_TEMPLATE_NOT_AVAILABLE,
    "errors.industry_template_not_available",
  );
}
