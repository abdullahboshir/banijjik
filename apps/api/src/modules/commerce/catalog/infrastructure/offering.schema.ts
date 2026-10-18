import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  UNIT_KEY,
  VARIANT_STATUS,
  type KindDetails,
  type OfferingStatus,
  type QuantityRule,
  type StockComponent,
  type UnitKey,
  type VariantOverrides,
  type VariantStatus,
} from "@banijjik/contracts/catalog";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const OFFERING_MODEL_NAME = "Offering";
export const OFFERING_COLLECTION_NAME = "offerings";

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface VariantDocument {
  variantId: string;
  name: string;
  optionValues: Record<string, string>;
  price: MoneyDocument;
  compareAtPrice?: MoneyDocument;
  sku?: string;
  barcode?: string;
  unitKey: UnitKey;
  quantityRule?: QuantityRule;
  stockComponents: StockComponent[];
  overrides: VariantOverrides;
  status: VariantStatus;
}

export interface OfferingDocument {
  offeringId: string;
  organizationId: string;
  kind: OfferingKind;
  name: string;
  /** Lower-cased, Bangla-folded copy of the name, for prefix search. */
  nameSearch: string;
  slug: string;
  status: OfferingStatus;
  description?: string;
  categoryIds: string[];
  modifierGroupIds: string[];
  imageFileIds: string[];
  variants: VariantDocument[];
  kindDetails: KindDetails;
  taxClassKey?: string;
  synonyms: string[];
  /** Folded copy of `synonyms`, for prefix search. */
  searchTerms: string[];
  customFields?: Record<string, unknown>;
  customFieldSearch?: { fieldKey: string; value: string }[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const moneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const quantityRuleSchema = new Schema<QuantityRule>(
  { min: { type: Number, required: true }, step: { type: Number, required: true }, max: Number },
  SUB_SCHEMA_OPTIONS,
);

const stockComponentSchema = new Schema<StockComponent>(
  { inventoryItemId: { type: String, required: true }, quantity: { type: Number, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const variantSchema = new Schema<VariantDocument>(
  {
    variantId: { type: String, required: true },
    name: { type: String, required: true },
    optionValues: { type: Schema.Types.Mixed, default: {} },
    price: { type: moneySchema, required: true },
    compareAtPrice: { type: moneySchema },
    sku: { type: String },
    barcode: { type: String },
    unitKey: { type: String, required: true, enum: Object.values(UNIT_KEY) },
    quantityRule: { type: quantityRuleSchema },
    stockComponents: { type: [stockComponentSchema], default: [] },
    overrides: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, required: true, enum: Object.values(VARIANT_STATUS) },
  },
  SUB_SCHEMA_OPTIONS,
);

const customFieldSearchSchema = new Schema(
  { fieldKey: { type: String, required: true }, value: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const offeringSchema = new Schema<OfferingDocument>(
  {
    ...domainIdField("offeringId"),
    organizationId: { type: String, required: true, immutable: true },
    kind: { type: String, required: true, immutable: true, enum: Object.values(OFFERING_KIND) },
    name: { type: String, required: true },
    nameSearch: { type: String, required: true },
    slug: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(OFFERING_STATUS) },
    description: { type: String },
    categoryIds: { type: [String], default: [] },
    modifierGroupIds: { type: [String], default: [] },
    imageFileIds: { type: [String], default: [] },
    variants: { type: [variantSchema], required: true },
    kindDetails: { type: Schema.Types.Mixed, required: true },
    taxClassKey: { type: String },
    synonyms: { type: [String], default: [] },
    searchTerms: { type: [String], default: [] },
    customFields: { type: Schema.Types.Mixed },
    customFieldSearch: { type: [customFieldSearchSchema] },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

offeringSchema.index({ organizationId: 1, offeringId: 1 }, { unique: true });
offeringSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
// One organization-wide SKU. A multikey unique index only compares documents, so the domain checks repeats inside one offering.
offeringSchema.index(
  { organizationId: 1, "variants.sku": 1 },
  { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } },
);
offeringSchema.index(
  { organizationId: 1, "variants.barcode": 1 },
  { partialFilterExpression: { "variants.barcode": { $type: "string" } } },
);
// The list with and without a kind, newest change first.
offeringSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
offeringSchema.index({ organizationId: 1, kind: 1, status: 1, updatedAt: -1 });
offeringSchema.index({ organizationId: 1, categoryIds: 1, status: 1 });
// The search branches: a folded name prefix and a folded synonym prefix.
offeringSchema.index({ organizationId: 1, nameSearch: 1 });
offeringSchema.index({ organizationId: 1, searchTerms: 1 });
