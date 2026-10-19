import {
  DomainRuleError,
  ERROR_CODE,
  PLATFORM_RULE_KEY,
  ROLE_RULE_KEY,
  ROLE_STATUS,
} from "@banijjik/contracts";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

/** The same answer for an unknown identifier and a wrong password, so login reveals neither. */
export function invalidCredentials(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.UNAUTHENTICATED,
    messageKey: "errors.invalid_credentials",
  });
}

/** A missing, unknown, expired, revoked or reused session or token. */
export function sessionNotValid(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.UNAUTHENTICATED });
}

export function accountLocked(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.account_locked" });
}

export function accountDisabled(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.account_disabled" });
}

export function tooManyAttempts(retryAfterSeconds: number): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.RATE_LIMITED, retryAfterSeconds });
}

/** A field-level validation failure, in the same shape as the schema errors (14-API.md section 3). */
export function invalidField(path: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey }] },
  });
}

export type IdentifierField = "email" | "phone";

/** The email or phone number already belongs to an account. */
export class DuplicateIdentifierError extends DomainRuleError {
  constructor(readonly field: IdentifierField) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field } });
    this.name = "DuplicateIdentifierError";
  }
}

/**
 * A refresh that lost a race with another request using the same token (two tabs). It is a 401
 * like any other, but the browser must keep its cookies: the winner just set new ones.
 */
export class RefreshRaceError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.UNAUTHENTICATED });
    this.name = "RefreshRaceError";
  }
}

/** No role with this ID in the organization (a role of another organization looks the same, ADR-080). */
export function roleNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The six system roles are code templates; the tenant cannot change or archive them. */
export function systemRoleImmutable(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.system_role_immutable",
    details: { ruleKey: ROLE_RULE_KEY.SYSTEM_ROLE_IMMUTABLE },
  });
}

/** An ACTIVE member still holds the role, so archiving it would silently remove their access. */
export function roleInUse(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.role_in_use",
    details: { ruleKey: ROLE_RULE_KEY.ROLE_IN_USE },
  });
}

/** An archived role is read-only history. */
export function roleArchived(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    messageKey: "errors.role_archived",
    details: { currentStatus: ROLE_STATUS.ARCHIVED },
  });
}

/** Another ACTIVE role of the organization already has this name. */
export class DuplicateRoleNameError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.DUPLICATE,
      messageKey: "errors.role_name_taken",
      details: { field: "name" },
    });
    this.name = "DuplicateRoleNameError";
  }
}

/** The caller does not hold, at every location, some keys a role write would add or remove (ADR-092). */
export function rolePermissionsNotGrantable(permissionKeys: readonly string[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.role_permissions_not_grantable",
    details: { ruleKey: ROLE_RULE_KEY.ROLE_NOT_GRANTABLE, permissionKeys: [...permissionKeys] },
  });
}

/** No account has the identifier a grant asked for. */
export class OperatorUserNotFoundError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: "errors.operator_user_not_found",
      details: { ruleKey: PLATFORM_RULE_KEY.OPERATOR_USER_NOT_FOUND },
    });
    this.name = "OperatorUserNotFoundError";
  }
}

/** The account exists but is not ACTIVE, so it cannot operate the platform. */
export class OperatorUserNotActiveError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: "errors.operator_user_not_active",
      details: { ruleKey: PLATFORM_RULE_KEY.OPERATOR_USER_NOT_ACTIVE },
    });
    this.name = "OperatorUserNotActiveError";
  }
}

/** The user already has an operator record, whatever its status. */
export class OperatorExistsError extends DomainRuleError {
  constructor() {
    super({ code: ERROR_CODE.CONFLICT, messageKey: "errors.operator_exists" });
    this.name = "OperatorExistsError";
  }
}

/** Wrong PIN, unknown approver, or no grant at the location — never say which (ADR-121). */
export function approvalInvalid(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.APPROVAL_INVALID,
    messageKey: "errors.approval_invalid",
  });
}

/** Five wrong PINs locked this member's PIN for 15 minutes. */
export function approvalPinLocked(retryAfterSeconds: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.APPROVAL_PIN_LOCKED,
    messageKey: "errors.approval_pin_locked",
    retryAfterSeconds,
  });
}

/** The approval token is missing, expired, used, or does not match the expected action. */
export function approvalRequired(action?: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.APPROVAL_REQUIRED,
    messageKey: "errors.approval_required",
    ...(action === undefined ? {} : { details: { action } }),
  });
}

/** A person cannot change their own operator record; another SUPER_ADMIN must. */
export class OwnOperatorAccessError extends DomainRuleError {
  constructor() {
    super({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: "errors.own_operator_access",
      details: { ruleKey: PLATFORM_RULE_KEY.OWN_OPERATOR_ACCESS },
    });
    this.name = "OwnOperatorAccessError";
  }
}
