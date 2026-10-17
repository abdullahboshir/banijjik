import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { CONTACT_COLLECTION_NAME, CONTACT_MODEL_NAME, contactSchema } from "./contact.schema.js";

/** Contacts live in the tenant database and are filtered by organization, never by location (09 section 5.1). */
export function registerContactModels(): void {
  registerModel({
    modelName: CONTACT_MODEL_NAME,
    collectionName: CONTACT_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: contactSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
