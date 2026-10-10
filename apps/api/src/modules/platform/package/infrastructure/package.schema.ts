import {
  LIMIT_KEY_VALUES,
  PACKAGE_STATUS,
  type LimitKey,
  type LimitValue,
  type ModuleKey,
  type PackageStatus,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const PACKAGE_MODEL_NAME = "Package";
export const PACKAGE_COLLECTION_NAME = "packages";

export interface PackageDocument {
  packageId: string;
  packageKey: string;
  nameKey: string;
  isAddOn: boolean;
  moduleKeys: ModuleKey[];
  limits: Record<LimitKey, LimitValue>;
  limitIncrements: Partial<Record<LimitKey, number>>;
  status: PackageStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

function limitFields(): Record<string, { type: NumberConstructor; default: null }> {
  return Object.fromEntries(LIMIT_KEY_VALUES.map((key) => [key, { type: Number, default: null }]));
}

function incrementFields(): Record<string, { type: NumberConstructor }> {
  return Object.fromEntries(LIMIT_KEY_VALUES.map((key) => [key, { type: Number }]));
}

export const packageSchema = new Schema<PackageDocument>(
  {
    ...domainIdField("packageId"),
    packageKey: { type: String, required: true },
    nameKey: { type: String, required: true },
    isAddOn: { type: Boolean, required: true },
    moduleKeys: [{ type: String, required: true }],
    limits: { type: new Schema(limitFields(), SUB_SCHEMA_OPTIONS), required: true },
    limitIncrements: { type: new Schema(incrementFields(), SUB_SCHEMA_OPTIONS), default: {} },
    status: { type: String, required: true, enum: Object.values(PACKAGE_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

packageSchema.index({ packageId: 1 }, { unique: true });
packageSchema.index({ packageKey: 1 }, { unique: true });
packageSchema.index({ status: 1, isAddOn: 1 });
