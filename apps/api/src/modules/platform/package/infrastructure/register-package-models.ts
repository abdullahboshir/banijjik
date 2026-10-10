import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { PACKAGE_COLLECTION_NAME, PACKAGE_MODEL_NAME, packageSchema } from "./package.schema.js";

/** Registers the Package model. Packages are platform configuration, shared by every organization (ADR-043). */
export function registerPackageModels(): void {
  registerModel({
    modelName: PACKAGE_MODEL_NAME,
    collectionName: PACKAGE_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: packageSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
