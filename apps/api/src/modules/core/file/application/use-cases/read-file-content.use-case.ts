import { FILE_STATUS, type FileVariant } from "@banijjik/contracts/file";
import { fileNotFound } from "../../domain/errors.js";
import type { FileAssetId } from "../../domain/file-asset.entity.js";
import { openFileContent, type FileContent } from "../file-content.js";
import type { FileAssetRepository, FileStorage } from "../ports/file-ports.js";

export interface ReadFileContentDependencies {
  readonly assets: FileAssetRepository;
  readonly storage: FileStorage;
}

/** The bytes of a file of this organization, for a member who may read files. PUBLIC or PRIVATE alike. */
export class ReadFileContentUseCase {
  constructor(private readonly dependencies: ReadFileContentDependencies) {}

  async execute(input: {
    readonly fileId: FileAssetId;
    readonly variant: FileVariant | undefined;
  }): Promise<FileContent> {
    const { assets, storage } = this.dependencies;
    const asset = await assets.findById(input.fileId);
    if (asset === undefined || asset.status !== FILE_STATUS.ACTIVE) throw fileNotFound();
    return openFileContent({ asset, storage, variant: input.variant });
  }
}
