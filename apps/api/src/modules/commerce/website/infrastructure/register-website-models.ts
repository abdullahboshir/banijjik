import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { SITE_COLLECTION_NAME, SITE_MODEL_NAME, siteSchema } from "./site.schema.js";
import {
  SITE_PAGE_COLLECTION_NAME,
  SITE_PAGE_MODEL_NAME,
  sitePageSchema,
} from "./site-page.schema.js";
import {
  SITE_DOMAIN_COLLECTION_NAME,
  SITE_DOMAIN_MODEL_NAME,
  siteDomainSchema,
} from "./site-domain.schema.js";
import {
  WEBSITE_VERSION_COLLECTION_NAME,
  WEBSITE_VERSION_MODEL_NAME,
  websiteVersionSchema,
} from "./website-version.schema.js";
import {
  CHECKOUT_QUOTE_COLLECTION_NAME,
  CHECKOUT_QUOTE_MODEL_NAME,
  checkoutQuoteSchema,
} from "./checkout-quote.schema.js";
import {
  CHECKOUT_COLLECTION_NAME,
  CHECKOUT_MODEL_NAME,
  CHECKOUT_REQUEST_LINK_COLLECTION_NAME,
  CHECKOUT_REQUEST_LINK_MODEL_NAME,
  checkoutRequestLinkSchema,
  checkoutSchema,
} from "./checkout.schema.js";
import {
  CHECKOUT_ACCESS_COLLECTION_NAME,
  CHECKOUT_ACCESS_MODEL_NAME,
  checkoutAccessSchema,
} from "./checkout-access.schema.js";

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
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: SITE_DOMAIN_MODEL_NAME,
    collectionName: SITE_DOMAIN_COLLECTION_NAME,
    schema: siteDomainSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CHECKOUT_QUOTE_MODEL_NAME,
    collectionName: CHECKOUT_QUOTE_COLLECTION_NAME,
    schema: checkoutQuoteSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CHECKOUT_MODEL_NAME,
    collectionName: CHECKOUT_COLLECTION_NAME,
    schema: checkoutSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CHECKOUT_REQUEST_LINK_MODEL_NAME,
    collectionName: CHECKOUT_REQUEST_LINK_COLLECTION_NAME,
    schema: checkoutRequestLinkSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CHECKOUT_ACCESS_MODEL_NAME,
    collectionName: CHECKOUT_ACCESS_COLLECTION_NAME,
    schema: checkoutAccessSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
