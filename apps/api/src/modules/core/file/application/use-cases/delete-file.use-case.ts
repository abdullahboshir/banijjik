import { FILE_STATUS } from "@banijjik/contracts/file";
import type { UserId } from "@banijjik/ids";
import { reportError } from "../../../../../kernel/observability/report-error.js";
import { fileNotFound } from "../../domain/errors.js";
import { storageKeyOf, type FileAsset, type FileAssetId } from "../../domain/file-asset.entity.js";
import type {
  FileAssetRepository,
  FileStorage,
  FileUnitOfWork,
  FileUsageRepository,
} from "../ports/file-ports.js";

export interface DeleteFileDependencies {
  readonly assets: FileAssetRepository;
  readonly storage: FileStorage;
  readonly usage: FileUsageRepository;
  readonly unitOfWork: FileUnitOfWork;
}

/**
 * Marks a file DELETED, gives its bytes back to the quota, then removes the stored objects. Nothing
 * tracks references yet: a field that still names the file now points at nothing (the caller's
 * problem until reference tracking exists, see the module README).
 */
export class DeleteFileUseCase {
  constructor(private readonly dependencies: DeleteFileDependencies) {}

  async execute(input: {
    readonly fileId: FileAssetId;
    readonly actorUserId: UserId;
  }): Promise<void> {
    const { assets, usage, unitOfWork } = this.dependencies;
    const deleted = await unitOfWork.run(async () => {
      const asset = await assets.findById(input.fileId);
      if (asset === undefined || asset.status !== FILE_STATUS.ACTIVE) throw fileNotFound();
      await assets.markDeleted(asset, asset.version, input.actorUserId);
      await usage.release(asset.byteSize);
      return asset;
    });
    await this.removeObjects(deleted);
  }

  /** The record is already DELETED, so a storage failure is reported and left for cleanup, not thrown. */
  private async removeObjects(asset: FileAsset): Promise<void> {
    for (const variant of asset.variants) {
      try {
        await this.dependencies.storage.delete(storageKeyOf(asset.storageKey, variant.variantKey));
      } catch (error) {
        reportError(error, {});
      }
    }
  }
}
