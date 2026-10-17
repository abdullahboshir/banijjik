import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { FileAsset, type FileAssetId, type StoredVariant } from "../domain/file-asset.entity.js";
import type { FileAssetDocument, FileVariantDocument } from "./file-asset.schema.js";

function toVariantDocument(variant: StoredVariant): FileVariantDocument {
  return {
    variantKey: variant.variantKey,
    byteSize: variant.byteSize,
    ...(variant.width === undefined ? {} : { width: variant.width }),
    ...(variant.height === undefined ? {} : { height: variant.height }),
  };
}

export function toFileAssetDocument(asset: FileAsset): FileAssetDocument {
  return {
    fileId: asset.fileId,
    organizationId: asset.organizationId,
    purpose: asset.purpose,
    visibility: asset.visibility,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    originalName: asset.originalName,
    storageKey: asset.storageKey,
    variants: asset.variants.map(toVariantDocument),
    status: asset.status,
    version: asset.version,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    createdByUserId: asset.createdByUserId,
    updatedByUserId: asset.updatedByUserId,
  };
}

export function toFileAsset(document: FileAssetDocument): FileAsset {
  const stored = stripMongoInternals(document);
  return FileAsset.restore({
    fileId: asId<FileAssetId>(stored.fileId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    purpose: stored.purpose,
    visibility: stored.visibility,
    mimeType: stored.mimeType,
    byteSize: stored.byteSize,
    originalName: stored.originalName,
    storageKey: stored.storageKey,
    variants: stored.variants.map(toVariantDocument),
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: asId<UserId>(stored.createdByUserId),
    updatedByUserId: asId<UserId>(stored.updatedByUserId),
  });
}
