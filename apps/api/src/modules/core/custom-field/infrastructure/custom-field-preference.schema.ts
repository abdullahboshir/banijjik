import {
  CUSTOM_FIELD_ENTITY_TYPE,
  type CustomFieldEntityType,
  type LocalizedText,
  type OfferingKind,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const CUSTOM_FIELD_PREFERENCE_MODEL_NAME = "CustomFieldPreference";
export const CUSTOM_FIELD_PREFERENCE_COLLECTION_NAME = "custom_field_preferences";

export interface CustomFieldPreferenceDocument {
  customFieldPreferenceId: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  offeringKind: OfferingKind | null;
  fieldKey: string;
  isHidden: boolean;
  label?: LocalizedText;
  sortOrder?: number;
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

export const customFieldPreferenceSchema = new Schema<CustomFieldPreferenceDocument>(
  {
    ...domainIdField("customFieldPreferenceId"),
    organizationId: { type: String, required: true, immutable: true },
    entityType: { type: String, required: true, enum: Object.values(CUSTOM_FIELD_ENTITY_TYPE) },
    offeringKind: { type: String, default: null },
    fieldKey: { type: String, required: true },
    isHidden: { type: Boolean, required: true },
    label: { type: localizedTextSchema },
    sortOrder: { type: Number },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

customFieldPreferenceSchema.index(
  { organizationId: 1, entityType: 1, offeringKind: 1, fieldKey: 1 },
  { unique: true },
);
