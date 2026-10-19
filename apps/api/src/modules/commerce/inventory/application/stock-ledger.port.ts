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
import type { InventoryDependencies } from "./inventory-dependencies.js";

export interface StockLedgerReserveInput {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly actorUserId: UserId;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly lines: readonly StockLedgerLine[];
  /** Read before opening a transaction (settings cannot load inside one). */
  readonly allowNegativeStock: boolean;
}

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

  async commitSale(input: StockLedgerReserveInput): Promise<void> {
    const { stockLedger, items, settings, currency } = this.dependencies;
    const expanded = await this.expandLines(input.organizationId, input.lines);
    const orgCurrency = await currency.read(input.organizationId);
    const prepared = await Promise.all(
      expanded.map(async (line) => {
        const item = await items.findById(line.inventoryItemId);
        if (item === undefined) return undefined;
        const threshold = await settings.lowStockThresholdForItem(
          input.organizationId,
          item.lowStockThreshold,
        );
        return { line, item, threshold };
      }),
    );
    for (const row of prepared) {
      if (row === undefined) continue;
      await stockLedger.applyMovement({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        locationId: input.locationId,
        inventoryItem: row.item,
        currency: orgCurrency,
        quantityDelta: -row.line.quantity,
        reason: STOCK_MOVEMENT_REASON.SALE,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        offeringId: row.line.offeringId,
        variantId: row.line.variantId,
        lowStockThreshold: row.threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
    await this.release(input);
  }

  async returnStock(
    input: StockLedgerReserveInput & { readonly disposition: StockReturnDisposition },
  ): Promise<void> {
    const { stockLedger, items, settings, currency, levels } = this.dependencies;
    const expanded = await this.expandLines(input.organizationId, input.lines);
    const orgCurrency = await currency.read(input.organizationId);
    const reason =
      input.disposition === "RETURN_DAMAGED"
        ? STOCK_MOVEMENT_REASON.RETURN_DAMAGED
        : STOCK_MOVEMENT_REASON.RETURN;
    const prepared = await Promise.all(
      expanded.map(async (line) => {
        const item = await items.findById(line.inventoryItemId);
        if (item === undefined) return undefined;
        const threshold = await settings.lowStockThresholdForItem(
          input.organizationId,
          item.lowStockThreshold,
        );
        const fromLevel = await levels.findOne({
          organizationId: input.organizationId,
          locationId: input.locationId,
          inventoryItemId: line.inventoryItemId,
        });
        return { line, item, threshold, fromLevel };
      }),
    );
    for (const row of prepared) {
      if (row === undefined) continue;
      await stockLedger.applyMovement({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        locationId: input.locationId,
        inventoryItem: row.item,
        currency: orgCurrency,
        quantityDelta: row.line.quantity,
        reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        offeringId: row.line.offeringId,
        variantId: row.line.variantId,
        ...(row.fromLevel === undefined
          ? {}
          : {
              unitCost: {
                amount: row.fromLevel.averageUnitCostAmount,
                currency: row.fromLevel.averageUnitCostCurrency as Money["currency"],
              },
            }),
        lowStockThreshold: row.threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
  }

  private async expandLines(
    organizationId: OrganizationId,
    lines: readonly StockLedgerLine[],
  ): Promise<
    readonly {
      readonly inventoryItemId: InventoryItemId;
      readonly quantity: number;
      readonly offeringId: string;
      readonly variantId: string;
    }[]
  > {
    const { offerings } = this.dependencies;
    const expanded: {
      inventoryItemId: InventoryItemId;
      quantity: number;
      offeringId: string;
      variantId: string;
    }[] = [];
    for (const line of lines) {
      const variant = await offerings.findActiveVariant(
        organizationId,
        asId<OfferingId>(line.offeringId),
        line.variantId,
      );
      if (variant === undefined || variant.stockComponents.length === 0) continue;
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
