import { CATALOG_RECORD_STATUS, MODIFIER_SELECTION } from "@banijjik/contracts/catalog";
import type { CatalogRecordStatus, ModifierSelection } from "@banijjik/contracts/catalog";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { MoneyDocument } from "./offering.schema.js";

export const CATEGORY_MODEL_NAME = "Category";
export const CATEGORY_COLLECTION_NAME = "categories";
export const MODIFIER_GROUP_MODEL_NAME = "ModifierGroup";
export const MODIFIER_GROUP_COLLECTION_NAME = "modifier_groups";
export const OFFERING_LOCATION_MODEL_NAME = "OfferingLocation";
export const OFFERING_LOCATION_COLLECTION_NAME = "offering_locations";
export const SYNONYM_BOOK_MODEL_NAME = "SearchSynonymBook";
export const SYNONYM_BOOK_COLLECTION_NAME = "search_synonyms";
export const OFFERING_COUNTER_MODEL_NAME = "OfferingCounter";
export const OFFERING_COUNTER_COLLECTION_NAME = "offering_counters";

export interface CategoryDocument {
  categoryId: string;
  organizationId: string;
  name: string;
  slug: string;
  parentCategoryId?: string;
  sortOrder: number;
  imageFileId?: string;
  customFields?: Record<string, unknown>;
  customFieldSearch?: { fieldKey: string; value: string }[];
  status: CatalogRecordStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const customFieldSearchSchema = new Schema(
  { fieldKey: { type: String, required: true }, value: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const categorySchema = new Schema<CategoryDocument>(
  {
    ...domainIdField("categoryId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    parentCategoryId: { type: String },
    sortOrder: { type: Number, required: true },
    imageFileId: { type: String },
    customFields: { type: Schema.Types.Mixed },
    customFieldSearch: { type: [customFieldSearchSchema] },
    status: { type: String, required: true, enum: Object.values(CATALOG_RECORD_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
categorySchema.index({ organizationId: 1, categoryId: 1 }, { unique: true });
categorySchema.index({ organizationId: 1, slug: 1 }, { unique: true });
categorySchema.index({ organizationId: 1, status: 1, sortOrder: 1, name: 1 });
categorySchema.index({ organizationId: 1, parentCategoryId: 1, status: 1 });

export interface ModifierOptionDocument {
  modifierOptionId: string;
  name: string;
  priceDelta: MoneyDocument;
  status: CatalogRecordStatus;
}

export interface ModifierGroupDocument {
  modifierGroupId: string;
  organizationId: string;
  name: string;
  selection: ModifierSelection;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOptionDocument[];
  status: CatalogRecordStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const moneySchema = new Schema<MoneyDocument>(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const optionSchema = new Schema<ModifierOptionDocument>(
  {
    modifierOptionId: { type: String, required: true },
    name: { type: String, required: true },
    priceDelta: { type: moneySchema, required: true },
    status: { type: String, required: true, enum: Object.values(CATALOG_RECORD_STATUS) },
  },
  SUB_SCHEMA_OPTIONS,
);

export const modifierGroupSchema = new Schema<ModifierGroupDocument>(
  {
    ...domainIdField("modifierGroupId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    selection: { type: String, required: true, enum: Object.values(MODIFIER_SELECTION) },
    isRequired: { type: Boolean, required: true },
    minSelect: { type: Number, required: true },
    maxSelect: { type: Number, required: true },
    options: { type: [optionSchema], required: true },
    status: { type: String, required: true, enum: Object.values(CATALOG_RECORD_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
modifierGroupSchema.index({ organizationId: 1, modifierGroupId: 1 }, { unique: true });
modifierGroupSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

export interface OfferingLocationDocument {
  offeringLocationId: string;
  organizationId: string;
  offeringId: string;
  /** Stored as null for an offering-wide row, so the unique index can see it. */
  variantId: string | null;
  locationId: string;
  isAvailable: boolean;
  priceOverride?: MoneyDocument;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const offeringLocationSchema = new Schema<OfferingLocationDocument>(
  {
    ...domainIdField("offeringLocationId"),
    organizationId: { type: String, required: true, immutable: true },
    offeringId: { type: String, required: true, immutable: true },
    variantId: { type: String, default: null, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    isAvailable: { type: Boolean, required: true },
    priceOverride: { type: moneySchema },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
offeringLocationSchema.index(
  { organizationId: 1, offeringId: 1, variantId: 1, locationId: 1 },
  { unique: true },
);
offeringLocationSchema.index({ organizationId: 1, locationId: 1, offeringId: 1 });

export interface SynonymBookDocument {
  searchSynonymId: string;
  organizationId: string;
  entries: { term: string; synonyms: string[] }[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const synonymEntrySchema = new Schema(
  { term: { type: String, required: true }, synonyms: { type: [String], required: true } },
  SUB_SCHEMA_OPTIONS,
);

/** One document per organization: the whole keyed list is read and replaced together. */
export const synonymBookSchema = new Schema<SynonymBookDocument>(
  {
    ...domainIdField("searchSynonymId"),
    organizationId: { type: String, required: true, immutable: true },
    entries: { type: [synonymEntrySchema], default: [] },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
synonymBookSchema.index({ organizationId: 1 }, { unique: true });

export interface OfferingCounterDocument {
  offeringCounterId: string;
  organizationId: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** The DRAFT and ACTIVE offerings of an organization, for the package limit. */
export const offeringCounterSchema = new Schema<OfferingCounterDocument>(
  {
    ...domainIdField("offeringCounterId"),
    organizationId: { type: String, required: true, immutable: true },
    count: { type: Number, required: true, default: 0, min: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
offeringCounterSchema.index({ organizationId: 1 }, { unique: true });
