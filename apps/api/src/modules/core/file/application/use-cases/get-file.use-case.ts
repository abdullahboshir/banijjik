import { FILE_STATUS, type FileAssetResponse } from "@banijjik/contracts/file";
import { fileNotFound } from "../../domain/errors.js";
import type { FileAssetId } from "../../domain/file-asset.entity.js";
import { viewFileAsset } from "../file-asset-view.js";
import type { FileAssetRepository } from "../ports/file-ports.js";

/** The metadata of one file of this organization. A deleted file, or another organization's, is 404. */
export class GetFileUseCase {
  constructor(private readonly assets: FileAssetRepository) {}

  async execute(input: { readonly fileId: FileAssetId }): Promise<FileAssetResponse> {
    const asset = await this.assets.findById(input.fileId);
    if (asset === undefined || asset.status !== FILE_STATUS.ACTIVE) throw fileNotFound();
    return viewFileAsset(asset);
  }
}
