import { PREFERRED_LOCALE, type PreferredLocale } from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const TERM_OVERRIDE_MODEL_NAME = "TermOverride";
export const TERM_OVERRIDE_COLLECTION_NAME = "term_overrides";

export interface TermOverrideDocument {
  termOverrideId: string;
  organizationId: string;
  termKey: string;
  locale: PreferredLocale;
  text: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const termOverrideSchema = new Schema<TermOverrideDocument>(
  {
    ...domainIdField("termOverrideId"),
    organizationId: { type: String, required: true, immutable: true },
    termKey: { type: String, required: true },
    locale: { type: String, required: true, enum: Object.values(PREFERRED_LOCALE) },
    text: { type: String, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

termOverrideSchema.index({ organizationId: 1, termOverrideId: 1 }, { unique: true });
termOverrideSchema.index({ organizationId: 1, termKey: 1, locale: 1 }, { unique: true });
