import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const SITE_MODEL_NAME = "Site";
export const SITE_COLLECTION_NAME = "sites";

export interface SiteDocument {
  siteId: string;
  organizationId: string;
  draftDesign: unknown;
  editPolicy: unknown;
  sourceTemplateKey: string;
  sourceTemplateRevision: number;
  publishedWebsiteVersionId: string | null;
  nextRevision: number;
  hasPublishedOnce: boolean;
  canonicalSiteDomainId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const siteSchema = new Schema<SiteDocument>(
  {
    ...domainIdField("siteId"),
    organizationId: { type: String, required: true, immutable: true },
    draftDesign: { type: Schema.Types.Mixed, required: true },
    editPolicy: { type: Schema.Types.Mixed, required: true },
    sourceTemplateKey: { type: String, required: true },
    sourceTemplateRevision: { type: Number, required: true },
    publishedWebsiteVersionId: { type: String, default: null },
    nextRevision: { type: Number, required: true, default: 1 },
    hasPublishedOnce: { type: Boolean, required: true, default: false },
    canonicalSiteDomainId: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

siteSchema.index({ organizationId: 1 }, { unique: true });
siteSchema.index({ organizationId: 1, siteId: 1 }, { unique: true });
