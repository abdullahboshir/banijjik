import type {
  StockMovementReason,
  StockSourceType,
  StockState,
} from "@banijjik/contracts/inventory";
import type { InventoryItemId, OrganizationId, StockMovementId } from "@banijjik/ids";

export interface StockMovementRecord {
  readonly stockMovementId: StockMovementId;
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly inventoryItemId: InventoryItemId;
  readonly quantityDelta: number;
  readonly stockState: StockState;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string;
  readonly unitCostAmount?: number;
  readonly unitCostCurrency?: string;
  /** Cost micros per base unit when the movement carries a unit cost (rebuild fidelity). */
  readonly unitCostMicros?: number;
  readonly offeringId?: string;
  readonly variantId?: string;
  readonly note?: string;
  readonly occurredAt: Date;
  readonly businessDate: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
}

export interface InventoryLevelRecord {
  readonly inventoryLevelId: string;
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly inventoryItemId: InventoryItemId;
  readonly onHand: number;
  readonly reserved: number;
  readonly damaged: number;
  /** Moving average in cost micros (minor × 10000) per base unit (ADR-125). */
  readonly averageUnitCostMicros: number;
  readonly averageUnitCostCurrency: string;
  readonly lowStockActive: boolean;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface StockReservationLineRecord {
  readonly inventoryItemId: string;
  readonly quantity: number;
}

export interface StockReservationRecord {
  readonly stockReservationId: string;
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly sourceType: StockSourceType;
  readonly sourceId: string;
  readonly lines: readonly StockReservationLineRecord[];
  readonly createdAt: Date;
}
