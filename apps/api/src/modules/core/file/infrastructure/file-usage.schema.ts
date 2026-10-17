import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const FILE_USAGE_MODEL_NAME = "FileUsage";
export const FILE_USAGE_COLLECTION_NAME = "file_usages";

export interface FileUsageDocument {
  fileUsageId: string;
  organizationId: string;
  usedBytes: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** One counter per organization: the stored bytes of its active files (the interim quota, ADR-109). */
export const fileUsageSchema = new Schema<FileUsageDocument>(
  {
    ...domainIdField("fileUsageId"),
    organizationId: { type: String, required: true, immutable: true },
    usedBytes: { type: Number, required: true, default: 0, min: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// The unique index is what makes two concurrent first uploads create one counter.
fileUsageSchema.index({ organizationId: 1 }, { unique: true });
fileUsageSchema.index({ fileUsageId: 1 }, { unique: true });
