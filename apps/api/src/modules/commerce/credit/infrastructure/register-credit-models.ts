import { getModelRegistry } from "../../../../kernel/db/index.js";
import { creditBalanceSchema, CREDIT_BALANCE_MODEL_NAME } from "./credit-balance.schema.js";
import { creditEntrySchema, CREDIT_ENTRY_MODEL_NAME } from "./credit-entry.schema.js";
import { creditPackSchema, CREDIT_PACK_MODEL_NAME } from "./credit-pack.schema.js";
import { listingUnlockSchema, LISTING_UNLOCK_MODEL_NAME } from "./listing-unlock.schema.js";

export function registerCreditModels(): void {
  const registry = getModelRegistry();
  registry.registerModel(CREDIT_PACK_MODEL_NAME, creditPackSchema);
  registry.registerModel(CREDIT_ENTRY_MODEL_NAME, creditEntrySchema);
  registry.registerModel(CREDIT_BALANCE_MODEL_NAME, creditBalanceSchema);
  registry.registerModel(LISTING_UNLOCK_MODEL_NAME, listingUnlockSchema);
}
