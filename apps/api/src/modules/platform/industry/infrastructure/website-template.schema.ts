import {
  WEBSITE_TEMPLATE_KEY_PATTERN,
  WEBSITE_TEMPLATE_STATUS,
  type WebsiteTemplateContent,
  type WebsiteTemplateStatus,
} from "@banijjik/contracts/website";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

// Mixed template snapshots must retain empty maps such as allowedVariantsBySection.
const WEBSITE_TEMPLATE_SCHEMA_OPTIONS = { ...SCHEMA_OPTIONS, minimize: false } as const;

export const WEBSITE_TEMPLATE_MODEL_NAME = "WebsiteTemplate";
export const WEBSITE_TEMPLATE_COLLECTION_NAME = "website_templates";
export const WEBSITE_TEMPLATE_REVISION_MODEL_NAME = "WebsiteTemplateRevision";
export const WEBSITE_TEMPLATE_REVISION_COLLECTION_NAME = "website_template_revisions";

export interface WebsiteTemplateDocument {
  websiteTemplateId: string;
  templateKey: string;
  status: WebsiteTemplateStatus;
  content: WebsiteTemplateContent;
  currentWebsiteTemplateRevisionId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface WebsiteTemplateRevisionDocument {
  websiteTemplateRevisionId: string;
  websiteTemplateId: string;
  templateKey: string;
  revision: number;
  snapshot: WebsiteTemplateContent;
  publishedAt: Date;
  publishedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const websiteTemplateSchema = new Schema<WebsiteTemplateDocument>(
  {
    ...domainIdField("websiteTemplateId"),
    templateKey: {
      type: String,
      required: true,
      immutable: true,
      match: WEBSITE_TEMPLATE_KEY_PATTERN,
    },
    status: { type: String, required: true, enum: Object.values(WEBSITE_TEMPLATE_STATUS) },
    content: { type: Schema.Types.Mixed, required: true },
    currentWebsiteTemplateRevisionId: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  WEBSITE_TEMPLATE_SCHEMA_OPTIONS,
);

websiteTemplateSchema.index({ websiteTemplateId: 1 }, { unique: true });
websiteTemplateSchema.index({ templateKey: 1 }, { unique: true });
websiteTemplateSchema.index({ status: 1, templateKey: 1 });

export const websiteTemplateRevisionSchema = new Schema<WebsiteTemplateRevisionDocument>(
  {
    ...domainIdField("websiteTemplateRevisionId"),
    websiteTemplateId: { type: String, required: true, immutable: true },
    templateKey: {
      type: String,
      required: true,
      immutable: true,
      match: WEBSITE_TEMPLATE_KEY_PATTERN,
    },
    revision: { type: Number, required: true, min: 1, immutable: true },
    snapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
    publishedAt: { type: Date, required: true, immutable: true },
    publishedByUserId: { type: String, required: true, immutable: true },
    ...auditFields,
  },
  WEBSITE_TEMPLATE_SCHEMA_OPTIONS,
);

websiteTemplateRevisionSchema.index({ websiteTemplateId: 1, revision: 1 }, { unique: true });
websiteTemplateRevisionSchema.index({ templateKey: 1, revision: -1 });
websiteTemplateRevisionSchema.index({ websiteTemplateRevisionId: 1 }, { unique: true });
