import {
  FILE_PURPOSE,
  FILE_STATUS,
  FILE_VARIANT,
  FILE_VISIBILITY,
  type FilePurpose,
  type FileStatus,
  type FileVariant,
  type FileVisibility,
} from "@banijjik/contracts/file";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const FILE_ASSET_MODEL_NAME = "FileAsset";
export const FILE_ASSET_COLLECTION_NAME = "file_assets";

export interface FileVariantDocument {
  variantKey: FileVariant;
  byteSize: number;
  width?: number;
  height?: number;
}

export interface FileAssetDocument {
  fileId: string;
  organizationId: string;
  purpose: FilePurpose;
  visibility: FileVisibility;
  mimeType: string;
  byteSize: number;
  originalName: string;
  storageKey: string;
  variants: FileVariantDocument[];
  status: FileStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  updatedByUserId: string;
}

const variantSchema = new Schema<FileVariantDocument>(
  {
    variantKey: { type: String, required: true, enum: Object.values(FILE_VARIANT) },
    byteSize: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  SUB_SCHEMA_OPTIONS,
);

export const fileAssetSchema = new Schema<FileAssetDocument>(
  {
    ...domainIdField("fileId"),
    organizationId: { type: String, required: true, immutable: true },
    purpose: { type: String, required: true, immutable: true, enum: Object.values(FILE_PURPOSE) },
    visibility: {
      type: String,
      required: true,
      immutable: true,
      enum: Object.values(FILE_VISIBILITY),
    },
    mimeType: { type: String, required: true },
    byteSize: { type: Number, required: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true, immutable: true },
    variants: { type: [variantSchema], required: true },
    status: { type: String, required: true, enum: Object.values(FILE_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// The public route finds a file by id alone, before any organization is known.
fileAssetSchema.index({ fileId: 1 }, { unique: true });
fileAssetSchema.index({ organizationId: 1, purpose: 1, createdAt: -1 });
