import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const SETTING_VALUE_MODEL_NAME = "SettingValue";
export const SETTING_VALUE_COLLECTION_NAME = "setting_values";

export interface SettingValueDocument {
  settingValueId: string;
  organizationId: string;
  settingKey: string;
  /** Null is the organization-level row. A location id is an override (ADR-016). */
  locationId: string | null;
  value: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const settingValueSchema = new Schema<SettingValueDocument>(
  {
    ...domainIdField("settingValueId"),
    organizationId: { type: String, required: true, immutable: true },
    settingKey: { type: String, required: true },
    locationId: { type: String, default: null },
    value: { type: Schema.Types.Mixed, required: true },
    ...versionField,
    ...auditFields,
  },
  // A boolean false and a null location must stay stored.
  { ...SCHEMA_OPTIONS, minimize: false },
);

settingValueSchema.index({ organizationId: 1, settingValueId: 1 }, { unique: true });
settingValueSchema.index({ organizationId: 1, settingKey: 1, locationId: 1 }, { unique: true });
