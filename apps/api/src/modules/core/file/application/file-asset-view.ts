import {
  FILE_VARIANT,
  FILE_VISIBILITY,
  publicFilePath,
  type FileAssetResponse,
  type FileVariant,
} from "@banijjik/contracts/file";
import type { FileAsset } from "../domain/file-asset.entity.js";

/** A PUBLIC image is linked at its medium size; a PUBLIC file without that size is not linked. */
const PUBLIC_LINK_VARIANT: FileVariant = FILE_VARIANT.medium;

export function viewFileAsset(asset: FileAsset): FileAssetResponse {
  const hasPublicLink =
    asset.visibility === FILE_VISIBILITY.PUBLIC && asset.hasVariant(PUBLIC_LINK_VARIANT);
  return {
    fileId: asset.fileId,
    purpose: asset.purpose,
    visibility: asset.visibility,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    originalName: asset.originalName,
    variants: asset.variants.map((variant) => ({
      variantKey: variant.variantKey,
      byteSize: variant.byteSize,
      ...(variant.width === undefined ? {} : { width: variant.width }),
      ...(variant.height === undefined ? {} : { height: variant.height }),
    })),
    ...(hasPublicLink ? { url: publicFilePath(asset.fileId, PUBLIC_LINK_VARIANT) } : {}),
    createdAt: asset.createdAt.toISOString(),
  };
}
