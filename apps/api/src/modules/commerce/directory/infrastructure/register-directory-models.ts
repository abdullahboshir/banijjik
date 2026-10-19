import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { LISTING_COLLECTION_NAME, LISTING_MODEL_NAME, listingSchema } from "./listing.schema.js";

/** Registers the directory models once at process start. */
export function registerDirectoryModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: LISTING_MODEL_NAME,
    collectionName: LISTING_COLLECTION_NAME,
    schema: listingSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
