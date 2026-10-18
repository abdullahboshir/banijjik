import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { CATALOG_RULE_KEY } from "@banijjik/contracts/catalog";

/** The shared base class lives in contracts (ADR-086); re-exported so module code keeps one import. */
export { DomainRuleError };

export interface FieldProblem {
  readonly path: string;
  readonly messageKey: string;
}

/** Several field-level failures at once, in the same shape as the schema errors (14-API.md section 3). */
export function invalidFields(fields: readonly FieldProblem[]): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, details: { fields } });
}

export function invalidField(path: string, messageKey: string): DomainRuleError {
  return invalidFields([{ path, messageKey }]);
}

/** No such record in this organization; one of another organization looks the same (ADR-080). */
export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The transition is not allowed from the current status (an archived record is read-only). */
export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

export function kindNotAllowed(): DomainRuleError {
  return invalidField("kind", "errors.offering_kind_not_allowed");
}

export function currencyMismatch(path: string): DomainRuleError {
  return invalidField(path, "errors.offering_currency_mismatch");
}

/** An id the request names does not belong to this organization, is archived, or has the wrong purpose. */
export function referenceInvalid(path: string): DomainRuleError {
  return invalidField(path, "errors.offering_reference_invalid");
}

export function slugTaken(slug: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.offering_slug_taken",
    details: { slug },
  });
}

export function skuTaken(sku: string, offeringId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.offering_sku_taken",
    details: { sku, offeringId },
  });
}

/** The unique index refused a SKU: a concurrent create won. The use case turns it into `skuTaken` once the winner can be read. */
export class SkuTakenError extends DomainRuleError {
  constructor(readonly sku: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "sku" } });
    this.name = "SkuTakenError";
  }
}

/** The unique index refused a slug: a concurrent write took it. */
export class SlugTakenError extends DomainRuleError {
  constructor(readonly slug: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "slug" } });
    this.name = "SlugTakenError";
  }
}

/** Stock comes from inventory items (card 3.3); until they exist a variant cannot name any. */
export function stockComponentsNeedInventory(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.offering_stock_components_need_inventory",
    details: { ruleKey: CATALOG_RULE_KEY.STOCK_COMPONENTS_NEED_INVENTORY },
  });
}

export function categoryInUse(counts: {
  readonly offerings: number;
  readonly childCategories: number;
}): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.category_in_use",
    details: { ruleKey: CATALOG_RULE_KEY.CATEGORY_IN_USE, ...counts },
  });
}

/** The caller may not read sensitive values, so they may not set or clear one either (ADR-107). */
export function customFieldSensitiveForbidden(fieldKeys: readonly string[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.FORBIDDEN,
    messageKey: "errors.custom_field_sensitive_forbidden",
    details: { fieldKeys },
  });
}

/** The caller's role does not reach the location (14-API.md section 3). */
export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}
