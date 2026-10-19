import { newId, type InventoryItemId, type OrganizationId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { InventoryLevelRepository } from "../application/ports/stock-repository.js";
import type { InventoryLevelRecord } from "../application/ports/stock-records.js";
import { insufficientStock } from "../domain/errors.js";
import { INVENTORY_LEVEL_MODEL_NAME, type InventoryLevelDocument } from "./inventory.schemas.js";
import { listInventoryLevelsWithItems } from "./mongo-inventory-level-list.js";

export class MongoInventoryLevelRepository implements InventoryLevelRepository {
  async findOne(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
  }): Promise<InventoryLevelRecord | undefined> {
    const Model = models({ organizationId: input.organizationId }).get<InventoryLevelDocument>(
      INVENTORY_LEVEL_MODEL_NAME,
    );
    const document = await Model.findOne(
      {
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
      },
      { _id: 0 },
      sessionOption(getActiveSession()),
    ).lean();
    return document === null ? undefined : (document as unknown as InventoryLevelRecord);
  }

  async saveExpectedVersion(
    document: InventoryLevelRecord,
    expectedVersion: number,
  ): Promise<InventoryLevelRecord> {
    const session = getActiveSession();
    const Model = models({ organizationId: document.organizationId }).get<InventoryLevelDocument>(
      INVENTORY_LEVEL_MODEL_NAME,
    );
    if (expectedVersion === 0) {
      const toInsert = { ...document, version: 1 } as InventoryLevelDocument;
      await Model.create([toInsert], sessionOption(session));
      return { ...document, version: 1 };
    }
    const updated = await updateVersioned({
      model: Model,
      filter: {
        organizationId: document.organizationId,
        locationId: document.locationId,
        inventoryItemId: document.inventoryItemId,
      },
      expectedVersion,
      update: {
        $set: {
          onHand: document.onHand,
          reserved: document.reserved,
          damaged: document.damaged,
          averageUnitCostMicros: document.averageUnitCostMicros,
          averageUnitCostCurrency: document.averageUnitCostCurrency,
          lowStockActive: document.lowStockActive,
          updatedAt: document.updatedAt,
        },
      },
      ...(session === undefined ? {} : { session }),
    });
    return updated as InventoryLevelRecord;
  }

  async changeReserved(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
    readonly currency: string;
    readonly reservedDelta: number;
    readonly allowNegative: boolean;
    readonly now: Date;
  }): Promise<InventoryLevelRecord> {
    const existing =
      (await this.findOne({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
      })) ??
      this.newLevel({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
        currency: input.currency,
        now: input.now,
      });
    const nextReserved = existing.reserved + input.reservedDelta;
    const nextAvailable = existing.onHand - nextReserved;
    if (!input.allowNegative && (nextReserved < 0 || nextAvailable < 0)) {
      throw insufficientStock(input.inventoryItemId, existing.onHand - existing.reserved);
    }
    const next: InventoryLevelRecord = {
      ...existing,
      reserved: nextReserved,
      updatedAt: input.now,
      version: existing.version + 1,
    };
    return this.saveExpectedVersion(next, existing.version);
  }

  newLevel(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly inventoryItemId: InventoryItemId;
    readonly currency: string;
    readonly now: Date;
  }): InventoryLevelRecord {
    return {
      inventoryLevelId: newId(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      inventoryItemId: input.inventoryItemId,
      onHand: 0,
      reserved: 0,
      damaged: 0,
      averageUnitCostMicros: 0,
      averageUnitCostCurrency: input.currency,
      lowStockActive: false,
      version: 0,
      updatedAt: input.now,
    };
  }

  listWithItems(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly q?: string;
    readonly lowOnly?: boolean;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly total: number }> {
    return listInventoryLevelsWithItems(input);
  }

  async listForOrganization(
    organizationId: OrganizationId,
    locationId?: string,
  ): Promise<readonly InventoryLevelRecord[]> {
    const filter: Record<string, unknown> = { organizationId };
    if (locationId !== undefined) filter.locationId = locationId;
    const Model = models({ organizationId }).get<InventoryLevelDocument>(
      INVENTORY_LEVEL_MODEL_NAME,
    );
    const rows = await Model.find(filter, { _id: 0 }, sessionOption(getActiveSession())).lean();
    return rows as unknown as InventoryLevelRecord[];
  }

  async aggregateOnHandByItem(
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
  > {
    const match: Record<string, unknown> = { organizationId };
    if (locationId !== undefined) match.locationId = locationId;
    const Model = models({ organizationId }).get(INVENTORY_LEVEL_MODEL_NAME);
    const rows = await Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: { locationId: "$locationId", inventoryItemId: "$inventoryItemId" },
          onHand: { $sum: "$onHand" },
          reserved: { $sum: "$reserved" },
          damaged: { $sum: "$damaged" },
          averageUnitCostMicros: { $first: "$averageUnitCostMicros" },
          averageUnitCostCurrency: { $first: "$averageUnitCostCurrency" },
        },
      },
    ]);
    const map = new Map<
      string,
      {
        onHand: number;
        reserved: number;
        damaged: number;
        averageUnitCostMicros: number;
        averageUnitCostCurrency: string;
      }
    >();
    for (const row of rows) {
      const key = `${row._id.locationId}:${row._id.inventoryItemId}`;
      map.set(key, {
        onHand: row.onHand,
        reserved: row.reserved,
        damaged: row.damaged,
        averageUnitCostMicros: row.averageUnitCostMicros,
        averageUnitCostCurrency: row.averageUnitCostCurrency,
      });
    }
    return map;
  }
}
