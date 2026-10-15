import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  SETTING_VALUE_COLLECTION_NAME,
  SETTING_VALUE_MODEL_NAME,
  settingValueSchema,
} from "./setting-value.schema.js";
import {
  TERM_OVERRIDE_COLLECTION_NAME,
  TERM_OVERRIDE_MODEL_NAME,
  termOverrideSchema,
} from "./term-override.schema.js";

/**
 * Organization tenancy, not location tenancy: an organization-level row has no location, and the
 * location plugin would require one on every row (ADR-103).
 */
export function registerSettingsModels(): void {
  registerModel({
    modelName: SETTING_VALUE_MODEL_NAME,
    collectionName: SETTING_VALUE_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: settingValueSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    modelName: TERM_OVERRIDE_MODEL_NAME,
    collectionName: TERM_OVERRIDE_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: termOverrideSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
