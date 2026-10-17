import { FILE_STATUS, type FilePurpose } from "@banijjik/contracts/file";
import { MongoFileAssetRepository } from "./infrastructure/mongo-file-asset.repository.js";
import type { FileAssetId } from "./domain/file-asset.entity.js";

/**
 * What other modules may ask the file module (ADR-109): does this file exist for the current
 * organization, is it still active, and was it uploaded for this purpose? Other modules call it
 * through their own port, adapted in routes.
 */
export interface FileReferenceReader {
  isUsable(fileId: string, purpose: FilePurpose): Promise<boolean>;
}

export function buildFileReferenceReader(): FileReferenceReader {
  const assets = new MongoFileAssetRepository();
  return {
    async isUsable(fileId, purpose) {
      const asset = await assets.findById(fileId as FileAssetId);
      return (
        asset !== undefined && asset.status === FILE_STATUS.ACTIVE && asset.purpose === purpose
      );
    },
  };
}
