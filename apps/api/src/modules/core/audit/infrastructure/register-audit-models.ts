import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  PLATFORM_AUDIT_LOG_COLLECTION_NAME,
  PLATFORM_AUDIT_LOG_MODEL_NAME,
  platformAuditLogSchema,
} from "./platform-audit-log.schema.js";
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
  // The operator copy lives in the platform database and belongs to no tenant (ADR-093).
  registerModel({
    modelName: PLATFORM_AUDIT_LOG_MODEL_NAME,
    collectionName: PLATFORM_AUDIT_LOG_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: platformAuditLogSchema,
    tenancy: MODEL_TENANCY.NONE,
    appendOnly: true,
  });
}
