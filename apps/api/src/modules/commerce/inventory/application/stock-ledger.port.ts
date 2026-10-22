import type { Money } from "@banijjik/contracts/catalog";
import {
  STOCK_MOVEMENT_REASON,
  STOCK_SOURCE_TYPE,
  type StockLedgerLine,
  type StockReturnDisposition,
} from "@banijjik/contracts/inventory";
import {
  asId,
  newId,
  type InventoryItemId,
  type OfferingId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { recordNotFound, stockComponentsRequired } from "../domain/errors.js";
import { microsToMinor } from "../domain/money-math.js";
import type { InventoryDependencies } from "./inventory-dependencies.js";
import type { InventoryItem } from "../domain/inventory-item.entity.js";

export interface StockLedgerReserveInput {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  /** Unused by reserve and release (neither writes a movement); null from scheduled jobs. */
  readonly actorUserId: UserId | null;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly lines: readonly StockLedgerLine[];
  /** Read before opening a transaction (settings cannot load inside one). */
  readonly allowNegativeStock: boolean;
}

/** `commitSale` writes SALE movements, so it must name a real actor. */
export type StockLedgerCommitInput = StockLedgerReserveInput & { readonly actorUserId: UserId };

interface ExpandedComponentLine {
  readonly inventoryItemId: InventoryItemId;
  readonly quantity: number;
  readonly offeringId: string;
  readonly variantId: string;
}

/**
 * Sales-facing stock port (card 3.5). Reservations are the source of truth for commitSale:
 * SALE movements use the reserved component lines, not a fresh expand of today's variant.
 */
export class StockLedger {
  constructor(private readonly dependencies: InventoryDependencies) {}

  async reserve(input: StockLedgerReserveInput): Promise<void> {
    const { reservations, levels, currency, clock } = this.dependencies;
    const existing = await reservations.findBySource({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (existing !== undefined) return;
    const expanded = await this.expandLines(input.organizationId, input.lines);
    const orgCurrency = await currency.read(input.organizationId);
    const now = clock.now();
    for (const line of expanded) {
      await levels.changeReserved({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: line.inventoryItemId,
        currency: orgCurrency,
        reservedDelta: line.quantity,
        allowNegative: input.allowNegativeStock,
        now,
      });
    }
    await reservations.upsert({
      stockReservationId: newId(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      sourceType: input.sourceType as (typeof STOCK_SOURCE_TYPE)[keyof typeof STOCK_SOURCE_TYPE],
      sourceId: input.sourceId,
      lines: expanded.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
      })),
      createdAt: now,
    });
  }

  async release(input: StockLedgerReserveInput): Promise<void> {
    const { reservations, levels, currency, clock } = this.dependencies;
    const existing = await reservations.findBySource({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (existing === undefined) return;
    const orgCurrency = await currency.read(input.organizationId);
    const now = clock.now();
    for (const line of existing.lines) {
      await levels.changeReserved({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: line.inventoryItemId as InventoryItemId,
        currency: orgCurrency,
        reservedDelta: -line.quantity,
        allowNegative: input.allowNegativeStock,
        now,
      });
    }
    await reservations.deleteBySource({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
  }

  async commitSale(input: StockLedgerCommitInput): Promise<void> {
    const { stockLedger, settings, currency, reservations } = this.dependencies;
    const reservation = await reservations.findBySource({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (reservation === undefined) {
      throw recordNotFound();
    }
    const orgCurrency = await currency.read(input.organizationId);
    // SALE quantities come from the reservation (frozen at reserve time), not a re-expand.
    for (const line of reservation.lines) {
      const inventoryItemId = line.inventoryItemId as InventoryItemId;
      const item = await this.requireItem(inventoryItemId);
      const threshold = await settings.lowStockThresholdForItem(
        input.organizationId,
        item.lowStockThreshold,
      );
      await stockLedger.applyMovement({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        locationId: input.locationId,
        inventoryItem: item,
        currency: orgCurrency,
        quantityDelta: -line.quantity,
        reason: STOCK_MOVEMENT_REASON.SALE,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        lowStockThreshold: threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
    await this.release(input);
  }

  async returnStock(
    input: StockLedgerCommitInput & { readonly disposition: StockReturnDisposition },
  ): Promise<void> {
    const { stockLedger, settings, currency, levels } = this.dependencies;
    const expanded = await this.expandLines(input.organizationId, input.lines);
    const orgCurrency = await currency.read(input.organizationId);
    const reason =
      input.disposition === "RETURN_DAMAGED"
        ? STOCK_MOVEMENT_REASON.RETURN_DAMAGED
        : STOCK_MOVEMENT_REASON.RETURN;
    for (const line of expanded) {
      const item = await this.requireItem(line.inventoryItemId);
      const threshold = await settings.lowStockThresholdForItem(
        input.organizationId,
        item.lowStockThreshold,
      );
      const fromLevel = await levels.findOne({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: line.inventoryItemId,
      });
      await stockLedger.applyMovement({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        locationId: input.locationId,
        inventoryItem: item,
        currency: orgCurrency,
        quantityDelta: line.quantity,
        reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        offeringId: line.offeringId,
        variantId: line.variantId,
        ...(fromLevel === undefined
          ? {}
          : {
              unitCost: {
                amount: microsToMinor(fromLevel.averageUnitCostMicros),
                currency: fromLevel.averageUnitCostCurrency as Money["currency"],
              },
              unitCostMicros: fromLevel.averageUnitCostMicros,
            }),
        lowStockThreshold: threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
  }

  private async requireItem(inventoryItemId: InventoryItemId): Promise<InventoryItem> {
    const item = await this.dependencies.items.findById(inventoryItemId);
    if (item === undefined) throw recordNotFound();
    return item;
  }

  private async expandLines(
    organizationId: OrganizationId,
    lines: readonly StockLedgerLine[],
  ): Promise<readonly ExpandedComponentLine[]> {
    const { offerings } = this.dependencies;
    const expanded: ExpandedComponentLine[] = [];
    for (const line of lines) {
      const variant = await offerings.findActiveVariant(
        organizationId,
        asId<OfferingId>(line.offeringId),
        line.variantId,
      );
      if (variant === undefined) throw recordNotFound();
      if (variant.stockComponents.length === 0) {
        throw stockComponentsRequired(line.offeringId, line.variantId);
      }
      for (const component of variant.stockComponents) {
        expanded.push({
          inventoryItemId: component.inventoryItemId as InventoryItemId,
          quantity: component.quantity * line.quantity,
          offeringId: line.offeringId,
          variantId: line.variantId,
        });
      }
    }
    return expanded;
  }
}
