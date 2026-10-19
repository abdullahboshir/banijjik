import {
  CUSTOM_FIELD_DEFINITION_STATUS,
  CUSTOM_FIELD_ENTITY_TYPE,
  CONTACT_ROLE,
  CUSTOM_FIELD_TYPE,
  type ContactRole,
  type CustomFieldDefinitionStatus,
  type CustomFieldEntityType,
  type CustomFieldType,
  type CustomFieldValidationBounds,
  type CustomFieldVisibility,
  type LocalizedText,
  type OfferingKind,
} from "@banijjik/contracts";
import { LISTING_FIELD_TIER, type ListingFieldTier } from "@banijjik/contracts/directory";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const CUSTOM_FIELD_DEFINITION_MODEL_NAME = "CustomFieldDefinition";
export const CUSTOM_FIELD_DEFINITION_COLLECTION_NAME = "custom_field_definitions";

export interface CustomFieldDefinitionDocument {
  customFieldDefinitionId: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  offeringKind: OfferingKind | null;
  fieldKey: string;
  label: LocalizedText;
  fieldType: CustomFieldType;
  isRequired: boolean;
  options?: readonly string[];
  optionLabels?: Readonly<Record<string, LocalizedText>>;
  validation?: CustomFieldValidationBounds;
  referenceEntity?: "contact" | "member";
  appliesToContactRoles?: ContactRole[];
  listingTier?: ListingFieldTier;
  isFilterable?: boolean;
  sectionKey?: string;
  minAgeYears?: number;
  mustDifferFromAccountPhone?: boolean;
  visibility: CustomFieldVisibility;
  botAsk: boolean;
  isSearchable: boolean;
  isSensitive: boolean;
  sortOrder: number;
  status: CustomFieldDefinitionStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  updatedByUserId: string;
}

const localizedTextSchema = new Schema(
  {
    bn: { type: String, required: true },
    en: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const visibilitySchema = new Schema(
  {
    admin: { type: Boolean, required: true },
    storefront: { type: Boolean, required: true },
    bot: { type: Boolean, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const boundsSchema = new Schema(
  {
    min: { type: Number },
    max: { type: Number },
    maxLength: { type: Number },
  },
  SUB_SCHEMA_OPTIONS,
);

export const customFieldDefinitionSchema = new Schema<CustomFieldDefinitionDocument>(
  {
    ...domainIdField("customFieldDefinitionId"),
    organizationId: { type: String, required: true, immutable: true },
    entityType: {
      type: String,
      required: true,
      immutable: true,
      enum: Object.values(CUSTOM_FIELD_ENTITY_TYPE),
    },
    offeringKind: { type: String, default: null },
    fieldKey: { type: String, required: true, immutable: true },
    label: { type: localizedTextSchema, required: true },
    fieldType: {
      type: String,
      required: true,
      immutable: true,
      enum: Object.values(CUSTOM_FIELD_TYPE),
    },
    isRequired: { type: Boolean, required: true },
    options: { type: [String] },
    optionLabels: { type: Schema.Types.Mixed },
    validation: { type: boundsSchema },
    referenceEntity: { type: String, enum: ["contact", "member"] },
    // No default: an empty list would read as "no role" instead of "every role".
    appliesToContactRoles: {
      type: [{ type: String, enum: Object.values(CONTACT_ROLE) }],
      default: undefined,
    },
    listingTier: { type: String, enum: Object.values(LISTING_FIELD_TIER) },
    isFilterable: { type: Boolean },
    sectionKey: { type: String },
    minAgeYears: { type: Number },
    mustDifferFromAccountPhone: { type: Boolean },
    visibility: { type: visibilitySchema, required: true },
    botAsk: { type: Boolean, required: true },
    isSearchable: { type: Boolean, required: true },
    isSensitive: { type: Boolean, required: true },
    sortOrder: { type: Number, required: true },
    status: { type: String, required: true, enum: Object.values(CUSTOM_FIELD_DEFINITION_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

customFieldDefinitionSchema.index(
  { organizationId: 1, entityType: 1, offeringKind: 1, fieldKey: 1 },
  { unique: true },
);
customFieldDefinitionSchema.index({ organizationId: 1, entityType: 1, status: 1, sortOrder: 1 });
