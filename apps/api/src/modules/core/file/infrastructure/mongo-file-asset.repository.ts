import { FILE_STATUS } from "@banijjik/contracts/file";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { FileAssetRepository } from "../application/ports/file-ports.js";
import type { FileAsset, FileAssetId } from "../domain/file-asset.entity.js";
import { toFileAsset, toFileAssetDocument } from "./file-asset.mapper.js";
import { FILE_ASSET_MODEL_NAME, type FileAssetDocument } from "./file-asset.schema.js";

/** The tenant plugin adds the organization filter, so another organization's file is simply not found (ADR-087). */
export class MongoFileAssetRepository implements FileAssetRepository {
  async insert(asset: FileAsset): Promise<void> {
    await this.model().create([toFileAssetDocument(asset)], sessionOption(getActiveSession()));
  }

  async findById(fileId: FileAssetId): Promise<FileAsset | undefined> {
    const document = await this.model()
      .findOne({ fileId }, null, sessionOption(getActiveSession()))
      .lean<FileAssetDocument>();
    return document === null ? undefined : toFileAsset(document);
  }

  async markDeleted(asset: FileAsset, expectedVersion: number, actorUserId: UserId): Promise<void> {
    await updateVersioned<FileAssetDocument>({
      model: this.model(),
      filter: { fileId: asset.fileId },
      expectedVersion,
      update: { $set: { status: FILE_STATUS.DELETED, updatedByUserId: actorUserId } },
    });
  }

  private model() {
    return models({}).get<FileAssetDocument>(FILE_ASSET_MODEL_NAME);
  }
}
