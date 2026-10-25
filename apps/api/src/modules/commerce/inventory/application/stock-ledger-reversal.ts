import { CURRENCY_CODE, type CurrencyCode, ERROR_CODE } from "@banijjik/contracts";
import { STOCK_MOVEMENT_REASON, STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import type { Money } from "@banijjik/contracts/catalog";
import type { InventoryItemId, OrganizationId, UserId } from "@banijjik/ids";
import { DomainRuleError, recordNotFound } from "../domain/errors.js";
import type { InventoryDependencies } from "./inventory-dependencies.js";
import type { StockMovementRecord } from "./ports/stock-records.js";

interface ReverseReturnStockInput {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly actorUserId: UserId;
  readonly salesReturnId: string;
}

/** A damaged return is taken back out of the damaged bucket, a restocked one out of sellable. */
function reversalReasonOf(movement: StockMovementRecord) {
  return movement.reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED
    ? STOCK_MOVEMENT_REASON.RETURN_DAMAGED_REVERSAL
    : STOCK_MOVEMENT_REASON.RETURN_REVERSAL;
}

function isReturnMovement(movement: StockMovementRecord): boolean {
  return (
    movement.reason === STOCK_MOVEMENT_REASON.RETURN ||
    movement.reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED
  );
}

const KNOWN_CURRENCY_CODES: readonly string[] = Object.values(CURRENCY_CODE);

function isCurrencyCode(value: string): value is CurrencyCode {
  return KNOWN_CURRENCY_CODES.includes(value);
}

/** The stored unit cost, in the organization currency; another stored currency is a data fault. */
function storedUnitCost(
  movement: StockMovementRecord,
  organizationCurrency: string,
): { readonly unitCost?: Money } {
  if (movement.unitCostAmount === undefined || movement.unitCostCurrency === undefined) return {};
  const stored = movement.unitCostCurrency;
  if (stored !== organizationCurrency || !isCurrencyCode(stored)) {
    throw new DomainRuleError({
      code: ERROR_CODE.INTERNAL,
      details: { stockMovementId: movement.stockMovementId },
    });
  }
  return { unitCost: { amount: movement.unitCostAmount, currency: stored } };
}

export async function reverseReturnStock(
  dependencies: InventoryDependencies,
  input: ReverseReturnStockInput,
): Promise<void> {
  const movements = await dependencies.movements.findBySource({
    organizationId: input.organizationId,
    sourceType: STOCK_SOURCE_TYPE.SALES_RETURN,
    sourceId: input.salesReturnId,
  });
  const currency = await dependencies.currency.read(input.organizationId);
  const timeZone = await dependencies.timeZone.read(input.organizationId);
  // A not-received line wrote no movement, so it has nothing to reverse here.
  for (const movement of movements.filter(isReturnMovement)) {
    const item = await dependencies.items.findById(movement.inventoryItemId as InventoryItemId);
    if (item === undefined) throw recordNotFound();
    const threshold = await dependencies.settings.lowStockThresholdForItem(
      input.organizationId,
      item.lowStockThreshold,
    );
    await dependencies.stockLedger.applyMovement({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      locationId: input.locationId,
      inventoryItem: item,
      currency,
      timeZone,
      quantityDelta: -movement.quantityDelta,
      reason: reversalReasonOf(movement),
      sourceType: STOCK_SOURCE_TYPE.SALES_RETURN,
      sourceId: input.salesReturnId,
      ...(movement.offeringId === undefined ? {} : { offeringId: movement.offeringId }),
      ...(movement.variantId === undefined ? {} : { variantId: movement.variantId }),
      reversesStockMovementId: movement.stockMovementId,
      lowStockThreshold: threshold,
      allowNegativeStock: false,
      ...storedUnitCost(movement, currency),
      ...(movement.unitCostMicros === undefined ? {} : { unitCostMicros: movement.unitCostMicros }),
    });
  }
}
