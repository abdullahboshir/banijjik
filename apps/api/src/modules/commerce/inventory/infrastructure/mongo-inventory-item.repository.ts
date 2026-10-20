import { escapeRegExp } from "@banijjik/validation";
import { asId, type InventoryItemId, type OrganizationId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { InventoryItem } from "../domain/inventory-item.entity.js";
import { SkuTakenError } from "../domain/errors.js";
import { foldName } from "../domain/name-search.js";
import { toInventoryItem, toInventoryItemDocument } from "./inventory-item.mapper.js";
import {
  INVENTORY_ITEM_MODEL_NAME,
  INVENTORY_LEVEL_MODEL_NAME,
  type InventoryItemDocument,
} from "./inventory.schemas.js";

import type {
  InventoryItemPage,
  InventoryItemRepository,
} from "../application/ports/inventory-item-repository.js";

export class MongoInventoryItemRepository implements InventoryItemRepository {
  async insert(item: InventoryItem): Promise<void> {
    const session = getActiveSession();
    const Model = models({ organizationId: item.organizationId }).get<InventoryItemDocument>(
      INVENTORY_ITEM_MODEL_NAME,
    );
    try {
      await Model.create([toInventoryItemDocument(item)], sessionOption(session));
    } catch (error) {
      if (isDuplicateKeyError(error) && item.sku !== undefined) throw new SkuTakenError(item.sku);
      throw error;
    }
  }

  async save(item: InventoryItem, expectedVersion: number): Promise<InventoryItem> {
    const session = getActiveSession();
    const Model = models({ organizationId: item.organizationId }).get<InventoryItemDocument>(
      INVENTORY_ITEM_MODEL_NAME,
    );
    const document = toInventoryItemDocument(item);
    try {
      const sessionOpts = session === undefined ? {} : { session };
      const updated = await updateVersioned({
        model: Model,
        filter: { inventoryItemId: item.inventoryItemId },
        expectedVersion,
        update: {
          $set: {
            name: document.name,
            nameSearch: document.nameSearch,
            sku: document.sku,
            lowStockThreshold: document.lowStockThreshold,
            status: document.status,
            updatedAt: document.updatedAt,
            updatedByUserId: document.updatedByUserId,
          },
        },
        ...sessionOpts,
      });
      return toInventoryItem(updated);
    } catch (error) {
      if (isDuplicateKeyError(error) && item.sku !== undefined) throw new SkuTakenError(item.sku);
      throw error;
    }
  }

  async findById(inventoryItemId: InventoryItemId): Promise<InventoryItem | undefined> {
    const Model = models({}).get<InventoryItemDocument>(INVENTORY_ITEM_MODEL_NAME);
    const document = await Model.findOne(
      { inventoryItemId },
      { _id: 0 },
      sessionOption(getActiveSession()),
    ).lean();
    return document === null ? undefined : toInventoryItem(document);
  }

  async findIdBySku(
    organizationId: OrganizationId,
    sku: string,
    exceptItemId?: InventoryItemId,
  ): Promise<InventoryItemId | undefined> {
    const Model = models({ organizationId }).get<InventoryItemDocument>(INVENTORY_ITEM_MODEL_NAME);
    const filter: Record<string, unknown> = { organizationId, sku };
    if (exceptItemId !== undefined) filter.inventoryItemId = { $ne: exceptItemId };
    const document = await Model.findOne(
      filter,
      { inventoryItemId: 1, _id: 0 },
      sessionOption(getActiveSession()),
    ).lean();
    return document === null ? undefined : asId<InventoryItemId>(document.inventoryItemId);
  }

  async list(input: {
    readonly organizationId: OrganizationId;
    readonly q?: string;
    readonly status?: string;
    readonly page: number;
    readonly limit: number;
  }): Promise<InventoryItemPage> {
    const { organizationId, page, limit } = input;
    const filter: Record<string, unknown> = { organizationId };
    if (input.status !== undefined) filter.status = input.status;
    if (input.q !== undefined) {
      filter.nameSearch = { $regex: `^${escapeRegExp(foldName(input.q))}` };
    }
    const Model = models({ organizationId }).get<InventoryItemDocument>(INVENTORY_ITEM_MODEL_NAME);
    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      Model.find(filter, {
        _id: 0,
        inventoryItemId: 1,
        name: 1,
        sku: 1,
        baseUnitKey: 1,
        status: 1,
      })
        .sort({ nameSearch: 1, inventoryItemId: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(filter),
    ]);
    return {
      items: documents.map((document) => ({
        inventoryItemId: asId<InventoryItemId>(document.inventoryItemId),
        name: document.name,
        ...(document.sku === undefined ? {} : { sku: document.sku }),
        baseUnitKey: document.baseUnitKey,
        status: document.status,
      })),
      total,
    };
  }

  async hasOnHandAnywhere(
    organizationId: OrganizationId,
    inventoryItemId: InventoryItemId,
  ): Promise<boolean> {
    const Level = models({ organizationId }).get(INVENTORY_LEVEL_MODEL_NAME);
    const row = await Level.findOne(
      { organizationId, inventoryItemId, onHand: { $gt: 0 } },
      { _id: 1 },
    ).lean();
    return row !== null;
  }
}
