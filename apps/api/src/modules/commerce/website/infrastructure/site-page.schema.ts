import { SITE_PAGE_KEY, type SitePageKey } from "@banijjik/contracts/website";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const SITE_PAGE_MODEL_NAME = "SitePage";
export const SITE_PAGE_COLLECTION_NAME = "site_pages";

export interface LocalizedTextDocument {
  bn: string;
  en: string;
}

export interface SitePageDocument {
  sitePageId: string;
  organizationId: string;
  pageKey: SitePageKey;
  title: LocalizedTextDocument;
  body: LocalizedTextDocument;
  isPublished: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** Empty text is allowed: a page may be written in one language only. The bounds are in validation. */
const localizedTextSchema = new Schema(
  { bn: { type: String, default: "" }, en: { type: String, default: "" } },
  SUB_SCHEMA_OPTIONS,
);

export const sitePageSchema = new Schema<SitePageDocument>(
  {
    ...domainIdField("sitePageId"),
    organizationId: { type: String, required: true, immutable: true },
    pageKey: { type: String, required: true, enum: Object.values(SITE_PAGE_KEY) },
    title: { type: localizedTextSchema, required: true },
    body: { type: localizedTextSchema, required: true },
    isPublished: { type: Boolean, required: true, default: false },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

sitePageSchema.index({ organizationId: 1, pageKey: 1 }, { unique: true });
sitePageSchema.index({ organizationId: 1, isPublished: 1 });
