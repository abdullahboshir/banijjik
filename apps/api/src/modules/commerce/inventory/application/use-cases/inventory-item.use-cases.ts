import type { InventoryItemListItem, InventoryItemResponse } from "@banijjik/contracts/inventory";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { INVENTORY_ITEM_STATUS, type InventoryItemStatus } from "@banijjik/contracts/inventory";
import type { InventoryItemId, OrganizationId, UserId } from "@banijjik/ids";
import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../../../kernel/http/index.js";
import { InventoryItem } from "../../domain/inventory-item.entity.js";
import {
  baseUnitImmutable,
  itemHasStock,
  itemInUse,
  recordNotFound,
  SkuTakenError,
  versionConflict,
} from "../../domain/errors.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { recordItemArchived, recordItemCreated, recordItemUpdated } from "../inventory-records.js";
import { toInventoryItemResponse } from "../inventory-views.js";

export class ListInventoryItemsUseCase {
  constructor(private readonly dependencies: Pick<InventoryDependencies, "items">) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly q?: string;
    readonly status?: string;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly InventoryItemListItem[]; readonly hasNext: boolean }> {
    const page = await this.dependencies.items.list(input);
    return {
      items: page.items.map((item) => ({
        ...item,
        baseUnitKey: item.baseUnitKey as UnitKey,
        status: item.status as InventoryItemStatus,
      })),
      hasNext: page.total > input.page * input.limit,
    };
  }
}

export class GetInventoryItemUseCase {
  constructor(private readonly dependencies: Pick<InventoryDependencies, "items">) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly inventoryItemId: InventoryItemId;
  }): Promise<InventoryItemResponse> {
    const item = await this.dependencies.items.findById(input.inventoryItemId);
    if (item === undefined || item.organizationId !== input.organizationId) throw recordNotFound();
    return toInventoryItemResponse(item);
  }
}

export class CreateInventoryItemUseCase {
  constructor(
    private readonly dependencies: Pick<
      InventoryDependencies,
      "items" | "unitOfWork" | "audit" | "clock"
    >,
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly name: string;
    readonly sku?: string;
    readonly baseUnitKey: InventoryItem["baseUnitKey"];
    readonly lowStockThreshold?: number;
  }): Promise<InventoryItemResponse> {
    const { unitOfWork, clock, audit, items } = this.dependencies;
    try {
      return await unitOfWork.run(async () => {
        const item = InventoryItem.create({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          name: input.name,
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          baseUnitKey: input.baseUnitKey,
          ...(input.lowStockThreshold === undefined
            ? {}
            : { lowStockThreshold: input.lowStockThreshold }),
          now: clock.now(),
        });
        await items.insert(item);
        await recordItemCreated({ audit }, item);
        return toInventoryItemResponse(item);
      });
    } catch (error) {
      if (error instanceof SkuTakenError) {
        throw new AppError({
          code: ERROR_CODE.CONFLICT,
          messageKey: "errors.inventory_sku_taken",
          details: { sku: error.sku },
        });
      }
      throw error;
    }
  }
}

export class UpdateInventoryItemUseCase {
  constructor(
    private readonly dependencies: Pick<
      InventoryDependencies,
      "items" | "movements" | "unitOfWork" | "audit" | "clock"
    >,
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly inventoryItemId: InventoryItemId;
    readonly version: number;
    readonly name?: string;
    readonly sku?: string | null;
    readonly lowStockThreshold?: number | null;
  }): Promise<InventoryItemResponse> {
    const { items, unitOfWork, audit, clock } = this.dependencies;
    const existing = await items.findById(input.inventoryItemId);
    if (existing === undefined || existing.organizationId !== input.organizationId) {
      throw recordNotFound();
    }
    if (existing.version !== input.version) throw versionConflict();
    try {
      return await unitOfWork.run(async () => {
        const updated = existing.withUpdate({
          actorUserId: input.actorUserId,
          now: clock.now(),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.lowStockThreshold === undefined
            ? {}
            : { lowStockThreshold: input.lowStockThreshold }),
        });
        const saved = await items.save(updated, input.version);
        await recordItemUpdated({ audit }, existing, saved);
        return toInventoryItemResponse(saved);
      });
    } catch (error) {
      if (error instanceof SkuTakenError) {
        throw new AppError({
          code: ERROR_CODE.CONFLICT,
          messageKey: "errors.inventory_sku_taken",
          details: { sku: error.sku },
        });
      }
      throw error;
    }
  }
}

export class ArchiveInventoryItemUseCase {
  constructor(
    private readonly dependencies: Pick<
      InventoryDependencies,
      "items" | "offerings" | "unitOfWork" | "audit" | "clock"
    >,
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly inventoryItemId: InventoryItemId;
    readonly version: number;
  }): Promise<InventoryItemResponse> {
    const { items, offerings, unitOfWork, audit, clock } = this.dependencies;
    const existing = await items.findById(input.inventoryItemId);
    if (existing === undefined || existing.organizationId !== input.organizationId) {
      throw recordNotFound();
    }
    if (existing.status === INVENTORY_ITEM_STATUS.ARCHIVED) {
      return toInventoryItemResponse(existing);
    }
    if (existing.version !== input.version) throw versionConflict();
    if (await items.hasOnHandAnywhere(input.organizationId, input.inventoryItemId)) {
      throw itemHasStock();
    }
    if (await offerings.isInventoryItemUsedInActiveVariant(input.inventoryItemId)) {
      throw itemInUse();
    }
    return unitOfWork.run(async () => {
      const archived = existing.archived(input.actorUserId, clock.now());
      const saved = await items.save(archived, input.version);
      await recordItemArchived({ audit }, saved);
      return toInventoryItemResponse(saved);
    });
  }
}

export async function assertBaseUnitNotLocked(
  movements: InventoryDependencies["movements"],
  organizationId: OrganizationId,
  inventoryItemId: InventoryItemId,
): Promise<void> {
  const count = await movements.countForItem(organizationId, inventoryItemId);
  if (count > 0) throw baseUnitImmutable();
}
