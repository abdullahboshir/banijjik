import { newId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type { FileUsageRepository } from "../application/ports/file-ports.js";
import { FILE_USAGE_MODEL_NAME, type FileUsageDocument } from "./file-usage.schema.js";

/**
 * The organization's byte counter. `reserve` is one conditional update, so two uploads at the edge
 * cannot both pass; it runs in the upload's transaction, so a failed insert gives the bytes back.
 */
export class MongoFileUsageRepository implements FileUsageRepository {
  async ensure(): Promise<void> {
    try {
      await this.model().updateOne(
        {},
        { $setOnInsert: { fileUsageId: newId(), usedBytes: 0 } },
        { upsert: true },
      );
    } catch (error) {
      // Two first uploads at once: the other one created the counter, which is all we need.
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  async usedBytes(): Promise<number> {
    const usage = await this.model().findOne({}).lean<FileUsageDocument>();
    return usage?.usedBytes ?? 0;
  }

  async reserve(bytes: number, limitBytes: number): Promise<boolean> {
    const updated = await this.model().findOneAndUpdate(
      { usedBytes: { $lte: limitBytes - bytes } },
      { $inc: { usedBytes: bytes } },
      sessionOption(getActiveSession()),
    );
    return updated !== null;
  }

  async release(bytes: number): Promise<void> {
    await this.model().updateOne(
      {},
      { $inc: { usedBytes: -bytes } },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<FileUsageDocument>(FILE_USAGE_MODEL_NAME);
  }
}
