import type { CommissionSourceType } from "@banijjik/contracts/commission";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { CommissionSourceMarkRepository } from "../application/ports/commission-ports.js";
import {
  COMMISSION_SOURCE_MARK_MODEL_NAME,
  type CommissionSourceMarkDocument,
} from "./commission.schema.js";

function markModel(): Model<CommissionSourceMarkDocument> {
  return models({}).get<CommissionSourceMarkDocument>(COMMISSION_SOURCE_MARK_MODEL_NAME);
}

export class MongoCommissionSourceMarkRepository implements CommissionSourceMarkRepository {
  async touch(sourceType: CommissionSourceType, sourceId: string): Promise<void> {
    // Every accrual and reconcile of one source writes this same document, so two of them that
    // overlap conflict and the loser retries on the committed state.
    await markModel().updateOne(
      { sourceType, sourceId },
      { $inc: { touches: 1 } },
      { upsert: true, ...sessionOption(getActiveSession()) },
    );
  }
}
