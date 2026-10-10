import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  AUDIT_LOG_COLLECTION_NAME,
  AUDIT_LOG_MODEL_NAME,
  auditLogSchema,
} from "./audit-log.schema.js";

/**
 * Registers the audit model. It lives in the tenant database with the organization's other data,
 * and is append-only: an entry is never changed or deleted (ADR-014, ADR-089).
 */
export function registerAuditModels(): void {
  registerModel({
    modelName: AUDIT_LOG_MODEL_NAME,
    collectionName: AUDIT_LOG_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: auditLogSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    appendOnly: true,
  });
}
