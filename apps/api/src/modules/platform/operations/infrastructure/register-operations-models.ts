import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  HOST_CLAIM_COLLECTION_NAME,
  HOST_CLAIM_MODEL_NAME,
  hostClaimSchema,
} from "./host-claim.schema.js";
import {
  DOMAIN_OPERATION_COLLECTION_NAME,
  DOMAIN_OPERATION_MODEL_NAME,
  domainOperationSchema,
} from "./domain-operation.schema.js";

/** Host claims are platform routing data (plan 4.2 decision 4): one global row per host name. */
export function registerOperationsModels(): void {
  registerModel({
    database: DATABASE_KIND.PLATFORM,
    modelName: HOST_CLAIM_MODEL_NAME,
    collectionName: HOST_CLAIM_COLLECTION_NAME,
    schema: hostClaimSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    database: DATABASE_KIND.PLATFORM,
    modelName: DOMAIN_OPERATION_MODEL_NAME,
    collectionName: DOMAIN_OPERATION_COLLECTION_NAME,
    schema: domainOperationSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
