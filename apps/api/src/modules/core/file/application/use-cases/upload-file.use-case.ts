import { FILE_VARIANT, type FilePurpose, type FileAssetResponse } from "@banijjik/contracts/file";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { reportError } from "../../../../../kernel/observability/report-error.js";
import { fileQuotaExceeded, fileTooLarge, fileTypeNotAllowed } from "../../domain/errors.js";
import {
  FileAsset,
  newFileId,
  storageKeyOf,
  type StoredVariant,
} from "../../domain/file-asset.entity.js";
import { detectFileType, FILE_TYPE_GROUP, type DetectedFileType } from "../../domain/file-types.js";
import { purposeAcceptsGroup, sizeLimitOfGroup } from "../../domain/purpose-rules.js";
import { viewFileAsset } from "../file-asset-view.js";
import type {
  FileAssetRepository,
  FileStorage,
  FileUnitOfWork,
  FileUsageRepository,
  ImageProcessor,
  ProcessedVariant,
} from "../ports/file-ports.js";

const STORED_IMAGE_MIME_TYPE = "image/webp";

export interface UploadFileDependencies {
  readonly assets: FileAssetRepository;
  readonly storage: FileStorage;
  readonly usage: FileUsageRepository;
  readonly images: ImageProcessor;
  readonly unitOfWork: FileUnitOfWork;
  readonly clock: Clock;
  /** The per-organization ceiling in bytes (ADR-109). Tests lower it to reach the edge. */
  readonly quotaBytes: number;
}

export interface UploadFileInput {
  readonly organizationId: OrganizationId;
  /** Null when a storefront customer uploads (LISTING_PHOTO). */
  readonly actorUserId: UserId | null;
  readonly purpose: FilePurpose;
  readonly originalName: string;
  readonly bytes: Buffer;
}

/** The checks run again here even though the parser already stopped early: the use case never trusts its caller. */
function requireAcceptedType(input: UploadFileInput): DetectedFileType {
  const detected = detectFileType(input.bytes);
  if (detected === undefined) throw fileTypeNotAllowed();
  if (!purposeAcceptsGroup(input.purpose, detected.group)) throw fileTypeNotAllowed();
  const limit = sizeLimitOfGroup(detected.group);
  if (input.bytes.length > limit) throw fileTooLarge(limit);
  return detected;
}

function asStoredVariant(variant: ProcessedVariant): StoredVariant {
  return {
    variantKey: variant.variantKey,
    byteSize: variant.bytes.length,
    ...(variant.width === undefined ? {} : { width: variant.width }),
    ...(variant.height === undefined ? {} : { height: variant.height }),
  };
}

/**
 * Stores one checked file (ADR-109): the type is read from the content, images are re-encoded
 * without their metadata into three sizes, the bytes go to the storage port, and the record and
 * the organization's usage counter change in one transaction. Objects are written first so a
 * stored record always has its bytes; a failed transaction removes them again.
 */
export class UploadFileUseCase {
  constructor(private readonly dependencies: UploadFileDependencies) {}

  async execute(input: UploadFileInput): Promise<FileAssetResponse> {
    const { usage, quotaBytes } = this.dependencies;
    const detected = requireAcceptedType(input);
    const processed = await this.processedVariants(input.bytes, detected);
    const totalBytes = processed.reduce((total, variant) => total + variant.bytes.length, 0);
    await usage.ensure();
    // A cheap early refusal; the atomic reservation below is the one that cannot be raced.
    if ((await usage.usedBytes()) + totalBytes > quotaBytes) throw fileQuotaExceeded();

    const fileId = newFileId();
    const asset = FileAsset.create({
      fileId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      purpose: input.purpose,
      mimeType: mimeTypeOf(detected),
      originalName: input.originalName,
      variants: processed.map(asStoredVariant),
      now: this.dependencies.clock.now(),
    });
    await this.writeObjects(asset, processed);
    try {
      await this.saveRecord(asset, totalBytes);
    } catch (error) {
      await this.removeObjects(asset);
      throw error;
    }
    return viewFileAsset(asset);
  }

  private async processedVariants(
    bytes: Buffer,
    detected: DetectedFileType,
  ): Promise<readonly ProcessedVariant[]> {
    if (detected.group === FILE_TYPE_GROUP.IMAGE) return this.dependencies.images.process(bytes);
    return [{ variantKey: FILE_VARIANT.document, bytes }];
  }

  private async saveRecord(asset: FileAsset, totalBytes: number): Promise<void> {
    const { unitOfWork, usage, assets, quotaBytes } = this.dependencies;
    await unitOfWork.run(async () => {
      if (!(await usage.reserve(totalBytes, quotaBytes))) throw fileQuotaExceeded();
      await assets.insert(asset);
    });
  }

  private async writeObjects(
    asset: FileAsset,
    processed: readonly ProcessedVariant[],
  ): Promise<void> {
    const { storage } = this.dependencies;
    try {
      for (const variant of processed) {
        await storage.put(
          storageKeyOf(asset.storageKey, variant.variantKey),
          variant.bytes,
          asset.mimeType,
        );
      }
    } catch (error) {
      await this.removeObjects(asset);
      throw error;
    }
  }

  /** Cleanup must never hide the error that caused it, so a failure here is reported and dropped. */
  private async removeObjects(asset: FileAsset): Promise<void> {
    for (const variant of asset.variants) {
      try {
        await this.dependencies.storage.delete(storageKeyOf(asset.storageKey, variant.variantKey));
      } catch (cleanupError) {
        reportError(cleanupError, {});
      }
    }
  }
}

function mimeTypeOf(detected: DetectedFileType): string {
  return detected.group === FILE_TYPE_GROUP.IMAGE ? STORED_IMAGE_MIME_TYPE : detected.mimeType;
}
