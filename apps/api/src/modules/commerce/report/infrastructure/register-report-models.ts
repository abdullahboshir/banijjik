import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  DAILY_SUMMARY_COLLECTION_NAME,
  DAILY_SUMMARY_MODEL_NAME,
  dailySummarySchema,
  REPORT_EVENT_APPLIED_COLLECTION_NAME,
  REPORT_EVENT_APPLIED_MODEL_NAME,
  reportEventAppliedSchema,
} from "./report.schema.js";

export function registerReportModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: DAILY_SUMMARY_MODEL_NAME,
    collectionName: DAILY_SUMMARY_COLLECTION_NAME,
    schema: dailySummarySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: REPORT_EVENT_APPLIED_MODEL_NAME,
    collectionName: REPORT_EVENT_APPLIED_COLLECTION_NAME,
    schema: reportEventAppliedSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
