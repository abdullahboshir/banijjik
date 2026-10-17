import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  FILE_ASSET_COLLECTION_NAME,
  FILE_ASSET_MODEL_NAME,
  fileAssetSchema,
} from "./file-asset.schema.js";
import {
  FILE_USAGE_COLLECTION_NAME,
  FILE_USAGE_MODEL_NAME,
  fileUsageSchema,
} from "./file-usage.schema.js";

/** Tenant collections of the file module. */
export function registerFileModels(): void {
  registerModel({
    modelName: FILE_ASSET_MODEL_NAME,
    collectionName: FILE_ASSET_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: fileAssetSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    modelName: FILE_USAGE_MODEL_NAME,
    collectionName: FILE_USAGE_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: fileUsageSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
