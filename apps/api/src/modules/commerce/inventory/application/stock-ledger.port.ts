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
import { recordNotFound, returnCostMissing, stockComponentsRequired } from "../domain/errors.js";
import { microsToMinor } from "../domain/money-math.js";
import type { InventoryDependencies } from "./inventory-dependencies.js";
import type { InventoryItem } from "../domain/inventory-item.entity.js";
import type { InventoryLevelRecord } from "./ports/stock-records.js";

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

interface SoldCost {
  readonly micros: number;
  readonly currency: string;
}

function sameCost(left: SoldCost, right: SoldCost): boolean {
  return left.micros === right.micros && left.currency === right.currency;
}

/** The sale a return values its goods at: the order's SALE movements (plan 3.5b decision 7). */
export interface StockReturnCostSource {
  readonly sourceType: string;
  readonly sourceId: string;
}

interface ReturnUnitCostFields {
  readonly unitCost?: Money;
  readonly unitCostMicros?: number;
}

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
    const { stockLedger, settings, currency, timeZone, reservations } = this.dependencies;
    const reservation = await reservations.findBySource({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (reservation === undefined) {
      throw recordNotFound();
    }
    const orgCurrency = await currency.read(input.organizationId);
    const orgTimeZone = await timeZone.read(input.organizationId);
    // The reservation is freed before the SALE movements: the on-hand guard reads
    // `onHand - reserved`, so a sale would otherwise be blocked by its own reservation.
    // Both writes are in the caller's transaction, so the pair stays atomic.
    await this.release(input);
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
        timeZone: orgTimeZone,
        quantityDelta: -line.quantity,
        reason: STOCK_MOVEMENT_REASON.SALE,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        lowStockThreshold: threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
  }

  async returnStock(
    input: StockLedgerCommitInput & {
      readonly disposition: StockReturnDisposition;
      /** Set by a sales return: the goods go back at the cost the sale used. Unset: today's average. */
      readonly costFrom?: StockReturnCostSource;
    },
  ): Promise<void> {
    const { stockLedger, settings, currency, timeZone, levels } = this.dependencies;
    const expanded = await this.expandLines(input.organizationId, input.lines);
    const orgCurrency = await currency.read(input.organizationId);
    const orgTimeZone = await timeZone.read(input.organizationId);
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
        timeZone: orgTimeZone,
        quantityDelta: line.quantity,
        reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        offeringId: line.offeringId,
        variantId: line.variantId,
        ...(await this.returnUnitCostFields(input, line, fromLevel)),
        lowStockThreshold: threshold,
        allowNegativeStock: input.allowNegativeStock,
      });
    }
  }

  /**
   * A return that names its sale carries the cost the goods left stock at, so the reversed cost of
   * goods equals the cost posted at completion. Without a sale, it carries today's average.
   */
  private async returnUnitCostFields(
    input: { readonly organizationId: OrganizationId; readonly costFrom?: StockReturnCostSource },
    line: ExpandedComponentLine,
    fromLevel: InventoryLevelRecord | undefined,
  ): Promise<ReturnUnitCostFields> {
    if (input.costFrom !== undefined) {
      return this.soldUnitCostFields(input.organizationId, input.costFrom, line);
    }
    if (fromLevel === undefined) return {};
    return {
      unitCost: {
        amount: microsToMinor(fromLevel.averageUnitCostMicros),
        currency: fromLevel.averageUnitCostCurrency as Money["currency"],
      },
      unitCostMicros: fromLevel.averageUnitCostMicros,
    };
  }

  /**
   * Refuses when the sale has no SALE movement for the item with one agreed cost: the average is
   * never used silently in its place (plan 3.5b risks, decision 7).
   */
  private async soldUnitCostFields(
    organizationId: OrganizationId,
    costFrom: StockReturnCostSource,
    line: ExpandedComponentLine,
  ): Promise<ReturnUnitCostFields> {
    const movements = await this.dependencies.movements.findBySource({
      organizationId,
      sourceId: costFrom.sourceId,
      sourceType: costFrom.sourceType,
    });
    const soldCosts = movements.flatMap((movement) => {
      if (movement.reason !== STOCK_MOVEMENT_REASON.SALE) return [];
      if (movement.inventoryItemId !== line.inventoryItemId) return [];
      if (movement.unitCostMicros === undefined || movement.unitCostCurrency === undefined) {
        return [];
      }
      return [{ micros: movement.unitCostMicros, currency: movement.unitCostCurrency }];
    });
    const [first] = soldCosts;
    if (first === undefined || soldCosts.some((cost) => !sameCost(cost, first))) {
      throw returnCostMissing(costFrom.sourceId, line.inventoryItemId);
    }
    return {
      unitCost: {
        amount: microsToMinor(first.micros),
        currency: first.currency as Money["currency"],
      },
      unitCostMicros: first.micros,
    };
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
