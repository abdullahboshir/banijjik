import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  SITE_PAGE_COLLECTION_NAME,
  SITE_PAGE_MODEL_NAME,
  sitePageSchema,
} from "./site-page.schema.js";

export function registerWebsiteModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: SITE_PAGE_MODEL_NAME,
    collectionName: SITE_PAGE_COLLECTION_NAME,
    schema: sitePageSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
