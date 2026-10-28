import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { SITE_COLLECTION_NAME, SITE_MODEL_NAME, siteSchema } from "./site.schema.js";
import {
  SITE_PAGE_COLLECTION_NAME,
  SITE_PAGE_MODEL_NAME,
  sitePageSchema,
} from "./site-page.schema.js";
import {
  WEBSITE_VERSION_COLLECTION_NAME,
  WEBSITE_VERSION_MODEL_NAME,
  websiteVersionSchema,
} from "./website-version.schema.js";

export function registerWebsiteModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: SITE_PAGE_MODEL_NAME,
    collectionName: SITE_PAGE_COLLECTION_NAME,
    schema: sitePageSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: SITE_MODEL_NAME,
    collectionName: SITE_COLLECTION_NAME,
    schema: siteSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: WEBSITE_VERSION_MODEL_NAME,
    collectionName: WEBSITE_VERSION_COLLECTION_NAME,
    schema: websiteVersionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    appendOnly: true,
  });
}
