import { DATABASE_KIND } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  LOCATION_COLLECTION_NAME,
  LOCATION_MODEL_NAME,
  locationSchema,
} from "./location.schema.js";
import { MEMBER_COLLECTION_NAME, MEMBER_MODEL_NAME, memberSchema } from "./member.schema.js";
import {
  ORGANIZATION_COLLECTION_NAME,
  ORGANIZATION_MODEL_NAME,
  organizationSchema,
} from "./organization.schema.js";

/**
 * Registers the three organization models. All live in the platform database: they decide who may
 * do what where, and "list my organizations" must never fan out to dedicated databases (ADR-043).
 */
export function registerOrganizationModels(): void {
  registerModel({
    modelName: ORGANIZATION_MODEL_NAME,
    collectionName: ORGANIZATION_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: organizationSchema,
  });
  registerModel({
    modelName: LOCATION_MODEL_NAME,
    collectionName: LOCATION_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: locationSchema,
  });
  registerModel({
    modelName: MEMBER_MODEL_NAME,
    collectionName: MEMBER_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: memberSchema,
  });
}
