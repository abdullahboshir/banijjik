import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { StorageConfig } from "../../../config/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { FileStorage } from "./application/ports/file-ports.js";
import { DeleteFileUseCase } from "./application/use-cases/delete-file.use-case.js";
import { GetFileUseCase } from "./application/use-cases/get-file.use-case.js";
import { ReadFileContentUseCase } from "./application/use-cases/read-file-content.use-case.js";
import { ReadPublicFileUseCase } from "./application/use-cases/read-public-file.use-case.js";
import { UploadFileUseCase } from "./application/use-cases/upload-file.use-case.js";
import { ORGANIZATION_STORAGE_QUOTA_BYTES } from "./domain/file-limits.js";
import { LocalFileStorage } from "./infrastructure/local-file-storage.js";
import { MongoFileAssetRepository } from "./infrastructure/mongo-file-asset.repository.js";
import { MongoFileUsageRepository } from "./infrastructure/mongo-file-usage.repository.js";
import { S3FileStorage } from "./infrastructure/s3-file-storage.js";
import { SharpImageProcessor } from "./infrastructure/sharp-image-processor.js";
import { FileController } from "./presentation/file.controller.js";
import { buildFileRouter, buildPublicFileRouter } from "./presentation/file.router.js";
import type { ReadUploadOptions } from "./presentation/read-upload.js";

export { fileManifest } from "./module.manifest.js";
export { registerFileModels } from "./infrastructure/register-file-models.js";
export type { FileStorage } from "./application/ports/file-ports.js";
export { buildFileReferenceReader } from "./file-reference-reader.js";
export type { FileReferenceReader } from "./file-reference-reader.js";
export { UploadFileUseCase } from "./application/use-cases/upload-file.use-case.js";
export { readUpload } from "./presentation/read-upload.js";
export type { ReadUploadOptions } from "./presentation/read-upload.js";

export interface FileModuleDependencies {
  readonly clock: Clock;
  readonly permission: PermissionMiddlewareFactory;
  readonly storage: StorageConfig;
  /** Tests pass a lower quota or a shorter upload timeout, or their own storage. */
  readonly overrides?: {
    readonly quotaBytes?: number;
    readonly uploadOptions?: ReadUploadOptions;
    readonly fileStorage?: FileStorage;
  };
}

/** Shared upload use case for tenant and storefront listing-photo paths (ADR-109, ADR-127). */
export function buildUploadFileUseCase(input: {
  readonly clock: Clock;
  readonly storage: StorageConfig;
  readonly overrides?: FileModuleDependencies["overrides"];
}): UploadFileUseCase {
  const overrides = input.overrides ?? {};
  return new UploadFileUseCase({
    assets: new MongoFileAssetRepository(),
    storage: overrides.fileStorage ?? buildFileStorage(input.storage),
    usage: new MongoFileUsageRepository(),
    images: new SharpImageProcessor(),
    unitOfWork: new MongoUnitOfWork(),
    clock: input.clock,
    quotaBytes: overrides.quotaBytes ?? ORGANIZATION_STORAGE_QUOTA_BYTES,
  });
}

export function buildFileStorage(config: StorageConfig): FileStorage {
  return config.driver === "s3"
    ? new S3FileStorage(config)
    : new LocalFileStorage(config.localRoot);
}

/** The tenant router (permission-guarded) and the public router (PUBLIC files, no session). */
export function buildFileModule(dependencies: FileModuleDependencies): {
  readonly tenantRouter: ReturnType<typeof buildFileRouter>;
  readonly publicRouter: ReturnType<typeof buildPublicFileRouter>;
} {
  const { overrides = {} } = dependencies;
  const assets = new MongoFileAssetRepository();
  const storage = overrides.fileStorage ?? buildFileStorage(dependencies.storage);
  const controller = new FileController({
    uploadFile: new UploadFileUseCase({
      assets,
      storage,
      usage: new MongoFileUsageRepository(),
      images: new SharpImageProcessor(),
      unitOfWork: new MongoUnitOfWork(),
      clock: dependencies.clock,
      quotaBytes: overrides.quotaBytes ?? ORGANIZATION_STORAGE_QUOTA_BYTES,
    }),
    getFile: new GetFileUseCase(assets),
    readContent: new ReadFileContentUseCase({ assets, storage }),
    readPublic: new ReadPublicFileUseCase({ assets, storage }),
    deleteFile: new DeleteFileUseCase({
      assets,
      storage,
      usage: new MongoFileUsageRepository(),
      unitOfWork: new MongoUnitOfWork(),
    }),
    ...(overrides.uploadOptions === undefined ? {} : { uploadOptions: overrides.uploadOptions }),
  });
  return {
    tenantRouter: buildFileRouter(controller, dependencies.permission),
    publicRouter: buildPublicFileRouter(controller),
  };
}
