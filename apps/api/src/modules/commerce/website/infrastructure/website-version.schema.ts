import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const WEBSITE_VERSION_MODEL_NAME = "WebsiteVersion";
export const WEBSITE_VERSION_COLLECTION_NAME = "website_versions";

export interface WebsiteVersionDocument {
  websiteVersionId: string;
  organizationId: string;
  siteId: string;
  revision: number;
  schemaVersion: number;
  design: unknown;
  sourceTemplateKey: string;
  sourceTemplateRevision: number;
  publishedByUserId: string | null;
  publishedByPlatformOperatorId: string | null;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** Append-only published snapshot. A2 registers the model; A3 writes rows. */
export const websiteVersionSchema = new Schema<WebsiteVersionDocument>(
  {
    ...domainIdField("websiteVersionId"),
    organizationId: { type: String, required: true, immutable: true },
    siteId: { type: String, required: true, immutable: true },
    revision: { type: Number, required: true, immutable: true },
    schemaVersion: { type: Number, required: true, immutable: true },
    design: { type: Schema.Types.Mixed, required: true, immutable: true },
    sourceTemplateKey: { type: String, required: true, immutable: true },
    sourceTemplateRevision: { type: Number, required: true, immutable: true },
    publishedByUserId: { type: String, default: null, immutable: true },
    publishedByPlatformOperatorId: { type: String, default: null, immutable: true },
    publishedAt: { type: Date, required: true, immutable: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

websiteVersionSchema.index({ organizationId: 1, siteId: 1, revision: 1 }, { unique: true });
websiteVersionSchema.index({
  organizationId: 1,
  siteId: 1,
  publishedAt: -1,
  websiteVersionId: 1,
});
