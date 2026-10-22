import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { paymentSchema, PAYMENT_COLLECTION_NAME, PAYMENT_MODEL_NAME } from "./payment.schema.js";
import {
  paymentSummarySchema,
  PAYMENT_SUMMARY_COLLECTION_NAME,
  PAYMENT_SUMMARY_MODEL_NAME,
} from "./payment-summary.schema.js";
import {
  storeCreditEntrySchema,
  STORE_CREDIT_ENTRY_COLLECTION_NAME,
  STORE_CREDIT_ENTRY_MODEL_NAME,
} from "./store-credit-entry.schema.js";

export function registerPaymentModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: PAYMENT_MODEL_NAME,
    collectionName: PAYMENT_COLLECTION_NAME,
    schema: paymentSchema,
    appendOnly: true,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: STORE_CREDIT_ENTRY_MODEL_NAME,
    collectionName: STORE_CREDIT_ENTRY_COLLECTION_NAME,
    schema: storeCreditEntrySchema,
    appendOnly: true,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: PAYMENT_SUMMARY_MODEL_NAME,
    collectionName: PAYMENT_SUMMARY_COLLECTION_NAME,
    schema: paymentSummarySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
