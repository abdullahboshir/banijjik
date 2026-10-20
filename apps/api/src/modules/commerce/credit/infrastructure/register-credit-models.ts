import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  creditBalanceSchema,
  CREDIT_BALANCE_MODEL_NAME,
  CREDIT_BALANCE_COLLECTION_NAME,
} from "./credit-balance.schema.js";
import {
  creditEntrySchema,
  CREDIT_ENTRY_MODEL_NAME,
  CREDIT_ENTRY_COLLECTION_NAME,
} from "./credit-entry.schema.js";
import {
  creditPackSchema,
  CREDIT_PACK_MODEL_NAME,
  CREDIT_PACK_COLLECTION_NAME,
} from "./credit-pack.schema.js";
import {
  listingUnlockSchema,
  LISTING_UNLOCK_MODEL_NAME,
  LISTING_UNLOCK_COLLECTION_NAME,
} from "./listing-unlock.schema.js";

export function registerCreditModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CREDIT_PACK_MODEL_NAME,
    collectionName: CREDIT_PACK_COLLECTION_NAME,
    schema: creditPackSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CREDIT_ENTRY_MODEL_NAME,
    collectionName: CREDIT_ENTRY_COLLECTION_NAME,
    schema: creditEntrySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: CREDIT_BALANCE_MODEL_NAME,
    collectionName: CREDIT_BALANCE_COLLECTION_NAME,
    schema: creditBalanceSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: LISTING_UNLOCK_MODEL_NAME,
    collectionName: LISTING_UNLOCK_COLLECTION_NAME,
    schema: listingUnlockSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
