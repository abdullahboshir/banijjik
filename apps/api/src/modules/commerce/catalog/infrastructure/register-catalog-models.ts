import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  OFFERING_COLLECTION_NAME,
  OFFERING_MODEL_NAME,
  offeringSchema,
} from "./offering.schema.js";
import {
  CATEGORY_COLLECTION_NAME,
  CATEGORY_MODEL_NAME,
  categorySchema,
  MODIFIER_GROUP_COLLECTION_NAME,
  MODIFIER_GROUP_MODEL_NAME,
  modifierGroupSchema,
  OFFERING_COUNTER_COLLECTION_NAME,
  OFFERING_COUNTER_MODEL_NAME,
  OFFERING_LOCATION_COLLECTION_NAME,
  OFFERING_LOCATION_MODEL_NAME,
  offeringCounterSchema,
  offeringLocationSchema,
  SYNONYM_BOOK_COLLECTION_NAME,
  SYNONYM_BOOK_MODEL_NAME,
  synonymBookSchema,
} from "./record.schemas.js";

/**
 * Catalog data lives in the tenant database. Offerings, categories, groups and synonyms belong to
 * the whole organization; a per-location row is also limited to the caller's locations (ADR-005).
 */
export function registerCatalogModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: OFFERING_MODEL_NAME,
    collectionName: OFFERING_COLLECTION_NAME,
    schema: offeringSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: CATEGORY_MODEL_NAME,
    collectionName: CATEGORY_COLLECTION_NAME,
    schema: categorySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: MODIFIER_GROUP_MODEL_NAME,
    collectionName: MODIFIER_GROUP_COLLECTION_NAME,
    schema: modifierGroupSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: OFFERING_LOCATION_MODEL_NAME,
    collectionName: OFFERING_LOCATION_COLLECTION_NAME,
    schema: offeringLocationSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: SYNONYM_BOOK_MODEL_NAME,
    collectionName: SYNONYM_BOOK_COLLECTION_NAME,
    schema: synonymBookSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: OFFERING_COUNTER_MODEL_NAME,
    collectionName: OFFERING_COUNTER_COLLECTION_NAME,
    schema: offeringCounterSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
