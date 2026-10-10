import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  MODULE_OVERRIDE_COLLECTION_NAME,
  MODULE_OVERRIDE_MODEL_NAME,
  moduleOverrideSchema,
} from "./module-override.schema.js";

/** Registers the ModuleOverride model: platform database, one row per organization, module and effect. */
export function registerEntitlementModels(): void {
  registerModel({
    modelName: MODULE_OVERRIDE_MODEL_NAME,
    collectionName: MODULE_OVERRIDE_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: moduleOverrideSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
