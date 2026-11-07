import { newId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ReconciliationSourceType } from "@banijjik/contracts";
import type { ReconciliationCursorRepository } from "../application/reconciliation-ports.js";
import { ReconciliationCursor } from "../domain/reconciliation.entity.js";
import {
  RECONCILIATION_CURSOR_MODEL_NAME,
  type ReconciliationCursorDocument,
} from "./reconciliation.schema.js";

function cursorModel(): Model<ReconciliationCursorDocument> {
  return models({}).get<ReconciliationCursorDocument>(RECONCILIATION_CURSOR_MODEL_NAME);
}

export class MongoReconciliationCursorRepository implements ReconciliationCursorRepository {
  async findCursor(
    organizationId: string,
    sourceType: ReconciliationSourceType,
  ): Promise<ReconciliationCursor | undefined> {
    const doc = await cursorModel()
      .findOne({ organizationId, sourceType })
      .session(getActiveSession() ?? null)
      .lean<ReconciliationCursorDocument | null>();

    if (!doc) return undefined;

    return new ReconciliationCursor({
      reconciliationCursorId: doc.reconciliationCursorId,
      organizationId: doc.organizationId,
      sourceType: doc.sourceType as ReconciliationSourceType,
      lastScannedCreatedAt: doc.lastScannedCreatedAt,
      lastScannedId: doc.lastScannedId,
      version: doc.version,
      updatedAt: doc.updatedAt,
    });
  }

  async saveCursor(cursor: ReconciliationCursor): Promise<void> {
    await cursorModel().updateOne(
      { organizationId: cursor.organizationId, sourceType: cursor.sourceType },
      {
        $set: {
          lastScannedCreatedAt: cursor.lastScannedCreatedAt,
          lastScannedId: cursor.lastScannedId,
          version: cursor.version + 1,
        },
        $setOnInsert: {
          reconciliationCursorId: cursor.reconciliationCursorId || newId(),
        },
      },
      { upsert: true, ...sessionOption(getActiveSession()) },
    );
  }
}
