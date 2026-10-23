import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  COMMISSION_ENTRY_COLLECTION_NAME,
  COMMISSION_ENTRY_MODEL_NAME,
  COMMISSION_RULE_COLLECTION_NAME,
  COMMISSION_RULE_MODEL_NAME,
  commissionEntrySchema,
  commissionRuleSchema,
} from "./commission.schema.js";

/**
 * Entries are not registered `appendOnly`: a payout sets `payoutId` once, with a conditional
 * update (Part A2). Nothing else in the module updates or deletes an entry (ADR-014).
 */
export function registerCommissionModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: COMMISSION_RULE_MODEL_NAME,
    collectionName: COMMISSION_RULE_COLLECTION_NAME,
    schema: commissionRuleSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: COMMISSION_ENTRY_MODEL_NAME,
    collectionName: COMMISSION_ENTRY_COLLECTION_NAME,
    schema: commissionEntrySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
