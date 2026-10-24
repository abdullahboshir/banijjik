import type { InventoryItemId, OrganizationId, StockMovementId } from "@banijjik/ids";
import type {
  InventoryLevelRecord,
  StockMovementRecord,
  StockReservationRecord,
} from "./stock-records.js";

export interface StockMovementRepository {
  insert(document: StockMovementRecord): Promise<void>;
  countForOrganization(organizationId: OrganizationId): Promise<number>;
  countForItem(organizationId: OrganizationId, inventoryItemId: string): Promise<number>;
  list(input: {
    readonly organizationId: OrganizationId;
    readonly inventoryItemId?: string;
    readonly locationId?: string;
    readonly from?: Date;
    readonly to?: Date;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly StockMovementRecord[]; readonly total: number }>;
  listAllForOrganization(
    organizationId: OrganizationId,
    locationId?: string,
  ): Promise<readonly StockMovementRecord[]>;
  findById(stockMovementId: StockMovementId): Promise<StockMovementRecord | undefined>;
  findBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceId: string;
    readonly sourceType?: string;
  }): Promise<readonly StockMovementRecord[]>;
}

export interface InventoryLevelRepository {
  findOne(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
  }): Promise<InventoryLevelRecord | undefined>;
  saveExpectedVersion(
    document: InventoryLevelRecord,
    expectedVersion: number,
  ): Promise<InventoryLevelRecord>;
  changeReserved(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
    readonly currency: string;
    readonly reservedDelta: number;
    readonly allowNegative: boolean;
    readonly now: Date;
  }): Promise<InventoryLevelRecord>;
  newLevel(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
    readonly currency: string;
    readonly now: Date;
  }): InventoryLevelRecord;
  listWithItems(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly q?: string;
    readonly lowOnly?: boolean;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly total: number }>;
  listForOrganization(
    organizationId: OrganizationId,
    locationId?: string,
  ): Promise<readonly InventoryLevelRecord[]>;
  aggregateOnHandByItem(
    organizationId: OrganizationId,
    locationId?: string,
  ): Promise<
    Map<
      string,
      {
        onHand: number;
        reserved: number;
        damaged: number;
        averageUnitCostMicros: number;
        averageUnitCostCurrency: string;
      }
    >
  >;
}

export interface StockReservationRepository {
  findBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceType: string;
    readonly sourceId: string;
  }): Promise<StockReservationRecord | undefined>;
  upsert(document: StockReservationRecord): Promise<void>;
  deleteBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceType: string;
    readonly sourceId: string;
  }): Promise<void>;
}
