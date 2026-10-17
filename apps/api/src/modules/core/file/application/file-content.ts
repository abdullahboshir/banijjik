import { FILE_VARIANT, type FileVariant } from "@banijjik/contracts/file";
import type { Readable } from "node:stream";
import { fileNotFound } from "../domain/errors.js";
import { storageKeyOf, type FileAsset } from "../domain/file-asset.entity.js";
import type { FileStorage } from "./ports/file-ports.js";

export interface FileContent {
  readonly stream: Readable;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly originalName: string;
  /** PDFs are offered as downloads, never rendered inline. */
  readonly isDocument: boolean;
}

/** A PDF has the one `document` size; an image defaults to its medium size. */
function defaultVariantOf(asset: FileAsset): FileVariant {
  return asset.hasVariant(FILE_VARIANT.document) ? FILE_VARIANT.document : FILE_VARIANT.medium;
}

/** Opens one stored size of a file. A size the file does not have, or a missing object, is 404. */
export async function openFileContent(input: {
  readonly asset: FileAsset;
  readonly storage: FileStorage;
  readonly variant: FileVariant | undefined;
}): Promise<FileContent> {
  const { asset, storage } = input;
  const variantKey = input.variant ?? defaultVariantOf(asset);
  const variant = asset.variants.find((stored) => stored.variantKey === variantKey);
  if (variant === undefined) throw fileNotFound();
  const stream = await storage.get(storageKeyOf(asset.storageKey, variantKey));
  if (stream === undefined) throw fileNotFound();
  return {
    stream,
    mimeType: asset.mimeType,
    byteSize: variant.byteSize,
    originalName: asset.originalName,
    isDocument: variantKey === FILE_VARIANT.document,
  };
}
