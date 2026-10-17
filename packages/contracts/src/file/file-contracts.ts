import type { FilePurpose, FileVariant, FileVisibility } from "./file-purpose.js";

export interface FileVariantResponse {
  readonly variantKey: FileVariant;
  readonly byteSize: number;
  readonly width?: number;
  readonly height?: number;
}

/** What the API returns for a file (14-API.md, files). `url` is present for PUBLIC files only. */
export interface FileAssetResponse {
  readonly fileId: string;
  readonly purpose: FilePurpose;
  readonly visibility: FileVisibility;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly originalName: string;
  readonly variants: readonly FileVariantResponse[];
  readonly url?: string;
  readonly createdAt: string;
}

/** Where a PUBLIC file is served without a session. The web client prefixes the API origin. */
export const PUBLIC_FILE_PATH_PREFIX = "/api/v1/public/files";

export function publicFilePath(fileId: string, variant: FileVariant): string {
  return `${PUBLIC_FILE_PATH_PREFIX}/${fileId}/${variant}`;
}
