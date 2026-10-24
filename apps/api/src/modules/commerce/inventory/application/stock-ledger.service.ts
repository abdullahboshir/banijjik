import { type Money } from "@banijjik/contracts/catalog";
import type { StockMovementReason, StockReceiptPaidVia } from "@banijjik/contracts/inventory";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import type { InventoryItem } from "../domain/inventory-item.entity.js";
import type { InventoryLevelRecord, StockMovementRecord } from "./ports/stock-records.js";
import type { InventoryEventPublisher } from "./ports/inventory-context-ports.js";
import type {
  InventoryLevelRepository,
  StockMovementRepository,
} from "./ports/stock-repository.js";
import { publishStockChangeEvents } from "./stock-change-events.js";
import {
  computeMovementOutcome,
  type MovementComputation,
} from "./stock-ledger-movement.helpers.js";
import { stockOrderingKey } from "./stock-ordering-key.js";

export interface ApplyMovementInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly locationId: string;
  readonly inventoryItem: InventoryItem;
  readonly currency: string;
  readonly quantityDelta: number;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly note?: string;
  readonly unitCost?: Money;
  /** When set (e.g. transfers), average updates use micros without a minor round-trip. */
  readonly unitCostMicros?: number;
  readonly offeringId?: string;
  readonly variantId?: string;
  readonly reversesStockMovementId?: string;
  readonly paidVia?: StockReceiptPaidVia;
  readonly lowStockThreshold: number;
  readonly allowNegativeStock: boolean;
}

export interface ApplyMovementResult {
  readonly movement: StockMovementRecord;
  readonly level: InventoryLevelRecord;
  readonly lowStockCrossed: boolean;
}

export class StockLedgerService {
  constructor(
    private readonly dependencies: {
      readonly clock: Clock;
      readonly events: InventoryEventPublisher;
      readonly movements: StockMovementRepository;
      readonly levels: InventoryLevelRepository;
    },
  ) {}

  async applyMovement(input: ApplyMovementInput): Promise<ApplyMovementResult> {
    const now = this.dependencies.clock.now();
    const existing = await this.loadLevel(input, now);
    const computed = computeMovementOutcome({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      locationId: input.locationId,
      inventoryItemId: input.inventoryItem.inventoryItemId,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      ...(input.reversesStockMovementId === undefined
        ? {}
        : { reversesStockMovementId: input.reversesStockMovementId }),
      ...(input.offeringId === undefined ? {} : { offeringId: input.offeringId }),
      ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
      ...(input.note === undefined ? {} : { note: input.note }),
      unitCost: input.unitCost,
      ...(input.unitCostMicros === undefined ? {} : { unitCostMicros: input.unitCostMicros }),
      ...(input.paidVia === undefined ? {} : { paidVia: input.paidVia }),
      lowStockThreshold: input.lowStockThreshold,
      allowNegativeStock: input.allowNegativeStock,
      existing,
      now,
    });
    await this.persistMovement(input, computed);
    return {
      movement: computed.movement,
      level: computed.nextLevel,
      lowStockCrossed: computed.lowStockCrossed,
    };
  }

  private async persistMovement(
    input: ApplyMovementInput,
    computed: MovementComputation,
  ): Promise<void> {
    await this.dependencies.movements.insert(computed.movement);
    await this.dependencies.levels.saveExpectedVersion(
      computed.nextLevel,
      computed.existingVersion,
    );
    const orderingKey = stockOrderingKey(input.locationId, input.inventoryItem.inventoryItemId);
    await publishStockChangeEvents({
      events: this.dependencies.events,
      orderingKey,
      inventoryItemId: input.inventoryItem.inventoryItemId,
      locationId: input.locationId,
      nextOnHand: computed.nextOnHand,
      nextAvailable: computed.nextAvailable,
      crossedLowStock: computed.lowStockCrossed,
    });
  }

  private async loadLevel(input: ApplyMovementInput, now: Date): Promise<InventoryLevelRecord> {
    const found = await this.dependencies.levels.findOne({
      organizationId: input.organizationId,
      locationId: input.locationId,
      inventoryItemId: input.inventoryItem.inventoryItemId,
    });
    if (found !== undefined) return found;
    return this.dependencies.levels.newLevel({
      organizationId: input.organizationId,
      locationId: input.locationId,
      inventoryItemId: input.inventoryItem.inventoryItemId,
      currency: input.currency,
      now,
    });
  }
}
