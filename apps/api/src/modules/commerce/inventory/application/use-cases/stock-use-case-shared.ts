import { ERROR_CODE } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/catalog";
import type { InventoryItemId, OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { recordNotFound, locationForbidden } from "../../domain/errors.js";
import type { InventoryItem } from "../../domain/inventory-item.entity.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";

export const SOURCE_RECEIPT = "STOCK_RECEIPT";
export const SOURCE_ADJUSTMENT = "STOCK_ADJUSTMENT";
export const SOURCE_TRANSFER = "STOCK_TRANSFER";

export function assertLocationReach(
  allowedLocationIds: readonly string[] | "ALL",
  locationId: string,
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

export async function requireActiveLocation(
  locations: InventoryDependencies["locations"],
  locationId: string,
): Promise<void> {
  if (!(await locations.isActiveLocation(locationId))) {
    throw new AppError({
      code: ERROR_CODE.VALIDATION_ERROR,
      messageKey: "validation.invalid_value",
      details: { path: "locationId" },
    });
  }
}

export async function loadReceiptLine(input: {
  readonly deps: InventoryDependencies;
  readonly organizationId: OrganizationId;
  readonly line: {
    readonly inventoryItemId: InventoryItemId;
    readonly quantity: number;
    readonly unitCost: Money;
  };
  readonly currency: string;
}): Promise<{
  readonly line: typeof input.line;
  readonly item: InventoryItem;
  readonly threshold: number;
}> {
  const { deps, organizationId, line, currency } = input;
  const item = await deps.items.findById(line.inventoryItemId);
  if (item === undefined || item.organizationId !== organizationId) throw recordNotFound();
  if (line.unitCost.currency !== currency) {
    throw new AppError({
      code: ERROR_CODE.VALIDATION_ERROR,
      messageKey: "errors.offering_currency_mismatch",
    });
  }
  const threshold = await deps.settings.lowStockThresholdForItem(
    organizationId,
    item.lowStockThreshold,
  );
  return { line, item, threshold };
}

export async function loadStockLineItem(
  deps: Pick<InventoryDependencies, "items" | "settings">,
  organizationId: OrganizationId,
  inventoryItemId: InventoryItemId,
): Promise<{ readonly item: InventoryItem; readonly threshold: number }> {
  const item = await deps.items.findById(inventoryItemId);
  if (item === undefined || item.organizationId !== organizationId) throw recordNotFound();
  const threshold = await deps.settings.lowStockThresholdForItem(
    organizationId,
    item.lowStockThreshold,
  );
  return { item, threshold };
}
