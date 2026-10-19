import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { ACCOUNT_COLLECTION_NAME, ACCOUNT_MODEL_NAME, accountSchema } from "./account.schema.js";
import {
  JOURNAL_ENTRY_COLLECTION_NAME,
  JOURNAL_ENTRY_MODEL_NAME,
  journalEntrySchema,
} from "./journal-entry.schema.js";

/** Accounting data lives in the tenant database. Journal entries are append-only (ADR-014). */
export function registerAccountingModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: ACCOUNT_MODEL_NAME,
    collectionName: ACCOUNT_COLLECTION_NAME,
    schema: accountSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: JOURNAL_ENTRY_MODEL_NAME,
    collectionName: JOURNAL_ENTRY_COLLECTION_NAME,
    schema: journalEntrySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    appendOnly: true,
  });
}
