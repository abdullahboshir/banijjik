import type { OrganizationId, StockMovementId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { StockMovementRepository } from "../application/ports/stock-repository.js";
import type { StockMovementRecord } from "../application/ports/stock-records.js";
import { STOCK_MOVEMENT_MODEL_NAME, type StockMovementDocument } from "./inventory.schemas.js";

export class MongoStockMovementRepository implements StockMovementRepository {
  async insert(document: StockMovementRecord): Promise<void> {
    const session = getActiveSession();
    const Model = models({ organizationId: document.organizationId }).get<StockMovementDocument>(
      STOCK_MOVEMENT_MODEL_NAME,
    );
    await Model.create([document as StockMovementDocument], sessionOption(session));
  }

  async countForOrganization(organizationId: OrganizationId): Promise<number> {
    const Model = models({ organizationId }).get<StockMovementDocument>(STOCK_MOVEMENT_MODEL_NAME);
    return Model.countDocuments({ organizationId });
  }

  async countForItem(organizationId: OrganizationId, inventoryItemId: string): Promise<number> {
    const Model = models({ organizationId }).get<StockMovementDocument>(STOCK_MOVEMENT_MODEL_NAME);
    return Model.countDocuments({ organizationId, inventoryItemId });
  }

  async list(input: {
    readonly organizationId: OrganizationId;
    readonly inventoryItemId?: string;
    readonly locationId?: string;
    readonly from?: Date;
    readonly to?: Date;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly StockMovementRecord[]; readonly total: number }> {
    const filter: Record<string, unknown> = { organizationId: input.organizationId };
    if (input.inventoryItemId !== undefined) filter.inventoryItemId = input.inventoryItemId;
    if (input.locationId !== undefined) filter.locationId = input.locationId;
    if (input.from !== undefined || input.to !== undefined) {
      filter.occurredAt = {
        ...(input.from === undefined ? {} : { $gte: input.from }),
        ...(input.to === undefined ? {} : { $lte: input.to }),
      };
    }
    const Model = models({ organizationId: input.organizationId }).get<StockMovementDocument>(
      STOCK_MOVEMENT_MODEL_NAME,
    );
    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      Model.find(filter, { _id: 0 })
        .sort({ occurredAt: -1, stockMovementId: -1 })
        .skip(skip)
        .limit(input.limit)
        .lean(),
      Model.countDocuments(filter),
    ]);
    return { items: items as unknown as StockMovementRecord[], total };
  }

  async listAllForOrganization(
    organizationId: OrganizationId,
    locationId?: string,
  ): Promise<readonly StockMovementRecord[]> {
    const filter: Record<string, unknown> = { organizationId };
    if (locationId !== undefined) filter.locationId = locationId;
    const Model = models({ organizationId }).get<StockMovementDocument>(STOCK_MOVEMENT_MODEL_NAME);
    const items = await Model.find(filter, { _id: 0 })
      .sort({ occurredAt: 1, stockMovementId: 1 })
      .lean();
    return items as unknown as StockMovementRecord[];
  }

  async findById(stockMovementId: StockMovementId): Promise<StockMovementRecord | undefined> {
    const Model = models({}).get<StockMovementDocument>(STOCK_MOVEMENT_MODEL_NAME);
    const document = await Model.findOne({ stockMovementId }, { _id: 0 }).lean();
    return document === null ? undefined : (document as unknown as StockMovementRecord);
  }

  async findBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceId: string;
    readonly sourceType?: string;
  }): Promise<readonly StockMovementRecord[]> {
    const filter: Record<string, unknown> = {
      organizationId: input.organizationId,
      sourceId: input.sourceId,
    };
    if (input.sourceType !== undefined) {
      filter.sourceType = input.sourceType;
    }
    const Model = models({ organizationId: input.organizationId }).get<StockMovementDocument>(
      STOCK_MOVEMENT_MODEL_NAME,
    );
    const items = await Model.find(filter, { _id: 0 })
      .sort({ occurredAt: 1, stockMovementId: 1 })
      .lean();
    return items as unknown as StockMovementRecord[];
  }
}
