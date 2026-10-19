import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { INVENTORY_RULE_KEY } from "@banijjik/contracts/inventory";

export { DomainRuleError };

export function recordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function invalidTransition(currentStatus: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION, details: { currentStatus } });
}

export function skuTaken(sku: string, inventoryItemId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.inventory_sku_taken",
    details: { sku, inventoryItemId },
  });
}

export function itemHasStock(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.inventory_item_has_stock",
    details: { ruleKey: INVENTORY_RULE_KEY.ITEM_HAS_STOCK },
  });
}

export function itemInUse(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.inventory_item_in_use",
    details: { ruleKey: INVENTORY_RULE_KEY.ITEM_IN_USE },
  });
}

export function baseUnitImmutable(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.inventory_item_base_unit_immutable",
    details: { ruleKey: INVENTORY_RULE_KEY.ITEM_BASE_UNIT_IMMUTABLE },
  });
}

export function invalidStockComponent(path: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "errors.inventory_invalid_stock_component",
    details: { ruleKey: INVENTORY_RULE_KEY.INVALID_STOCK_COMPONENT, path },
  });
}

export function insufficientStock(inventoryItemId: string, available: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INSUFFICIENT_STOCK,
    details: { inventoryItemId, available },
  });
}

export function locationForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

export function versionConflict(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.CONFLICT });
}

export class SkuTakenError extends DomainRuleError {
  constructor(readonly sku: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "sku" } });
    this.name = "SkuTakenError";
  }
}
