import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { StockSourceType } from "@banijjik/contracts/inventory";
import type { StockReservationRepository } from "../application/ports/stock-repository.js";
import type { StockReservationRecord } from "../application/ports/stock-records.js";
import {
  STOCK_RESERVATION_MODEL_NAME,
  type StockReservationDocument,
} from "./inventory.schemas.js";

export class MongoStockReservationRepository implements StockReservationRepository {
  async findBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceType: string;
    readonly sourceId: string;
  }): Promise<StockReservationRecord | undefined> {
    const Model = models({ organizationId: input.organizationId }).get<StockReservationDocument>(
      STOCK_RESERVATION_MODEL_NAME,
    );
    const document = await Model.findOne(
      {
        organizationId: input.organizationId,
        sourceType: input.sourceType as StockSourceType,
        sourceId: input.sourceId,
      },
      { _id: 0 },
      sessionOption(getActiveSession()),
    ).lean();
    return document === null ? undefined : (document as unknown as StockReservationRecord);
  }

  async upsert(document: StockReservationRecord): Promise<void> {
    const session = getActiveSession();
    const Model = models({ organizationId: document.organizationId }).get<StockReservationDocument>(
      STOCK_RESERVATION_MODEL_NAME,
    );
    await Model.updateOne(
      {
        organizationId: document.organizationId,
        sourceType: document.sourceType,
        sourceId: document.sourceId,
      },
      { $setOnInsert: document as unknown as StockReservationDocument },
      { upsert: true, ...sessionOption(session) },
    );
  }

  async deleteBySource(input: {
    readonly organizationId: OrganizationId;
    readonly sourceType: string;
    readonly sourceId: string;
  }): Promise<void> {
    const session = getActiveSession();
    const Model = models({ organizationId: input.organizationId }).get<StockReservationDocument>(
      STOCK_RESERVATION_MODEL_NAME,
    );
    await Model.deleteOne(
      {
        organizationId: input.organizationId,
        sourceType: input.sourceType as StockSourceType,
        sourceId: input.sourceId,
      },
      sessionOption(session),
    );
  }
}
