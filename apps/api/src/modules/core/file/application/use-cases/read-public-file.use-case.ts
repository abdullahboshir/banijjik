import { SYSTEM_REASON } from "@banijjik/contracts";
import { FILE_STATUS, FILE_VISIBILITY, type FileVariant } from "@banijjik/contracts/file";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { fileNotFound } from "../../domain/errors.js";
import type { FileAssetId } from "../../domain/file-asset.entity.js";
import { openFileContent, type FileContent } from "../file-content.js";
import type { FileAssetRepository, FileStorage } from "../ports/file-ports.js";

export interface ReadPublicFileDependencies {
  readonly assets: FileAssetRepository;
  readonly storage: FileStorage;
}

/**
 * Serves one PUBLIC, ACTIVE file without a session (logos and product images for websites). There
 * is no organization yet, so the lookup runs as the PUBLIC_FILE system reason; this is the only
 * use case that does (ADR-109). A PRIVATE or deleted file answers 404, never 403, so the existence
 * of private files is not revealed.
 */
export class ReadPublicFileUseCase {
  constructor(private readonly dependencies: ReadPublicFileDependencies) {}

  execute(input: {
    readonly fileId: FileAssetId;
    readonly variant: FileVariant;
  }): Promise<FileContent> {
    const { assets, storage } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PUBLIC_FILE, async () => {
      const asset = await assets.findById(input.fileId);
      const isServable =
        asset !== undefined &&
        asset.status === FILE_STATUS.ACTIVE &&
        asset.visibility === FILE_VISIBILITY.PUBLIC;
      if (!isServable) throw fileNotFound();
      return openFileContent({ asset, storage, variant: input.variant });
    });
  }
}
