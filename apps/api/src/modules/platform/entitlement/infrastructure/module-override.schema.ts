import {
  MODULE_OVERRIDE_EFFECT,
  type ModuleKey,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const MODULE_OVERRIDE_MODEL_NAME = "ModuleOverride";
export const MODULE_OVERRIDE_COLLECTION_NAME = "module_overrides";

export interface ModuleOverrideDocument {
  moduleOverrideId: string;
  organizationId: string;
  moduleKey: ModuleKey;
  effect: ModuleOverrideEffect;
  reason: string;
  expiresAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const moduleOverrideSchema = new Schema<ModuleOverrideDocument>(
  {
    ...domainIdField("moduleOverrideId"),
    organizationId: { type: String, required: true, immutable: true },
    moduleKey: { type: String, required: true },
    effect: { type: String, required: true, enum: Object.values(MODULE_OVERRIDE_EFFECT) },
    reason: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

moduleOverrideSchema.index({ organizationId: 1, moduleOverrideId: 1 }, { unique: true });
moduleOverrideSchema.index({ organizationId: 1, moduleKey: 1, effect: 1 }, { unique: true });
