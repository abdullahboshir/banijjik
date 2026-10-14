import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  CUSTOM_FIELD_DEFINITION_COLLECTION_NAME,
  CUSTOM_FIELD_DEFINITION_MODEL_NAME,
  customFieldDefinitionSchema,
} from "./custom-field-definition.schema.js";
import {
  CUSTOM_FIELD_PREFERENCE_COLLECTION_NAME,
  CUSTOM_FIELD_PREFERENCE_MODEL_NAME,
  customFieldPreferenceSchema,
} from "./custom-field-preference.schema.js";

/** Tenant collections. Industry fields are not stored here; they stay on the template (ADR-102). */
export function registerCustomFieldModels(): void {
  registerModel({
    modelName: CUSTOM_FIELD_DEFINITION_MODEL_NAME,
    collectionName: CUSTOM_FIELD_DEFINITION_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: customFieldDefinitionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    modelName: CUSTOM_FIELD_PREFERENCE_MODEL_NAME,
    collectionName: CUSTOM_FIELD_PREFERENCE_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: customFieldPreferenceSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
