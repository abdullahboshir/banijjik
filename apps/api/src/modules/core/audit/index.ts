import type { Router } from "express";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { ListAuditLogsUseCase } from "./application/use-cases/list-audit-logs.use-case.js";
import { MongoAuditLogRepository } from "./infrastructure/mongo-audit-log.repository.js";
import { MongoAuditRecorder } from "./infrastructure/mongo-audit-recorder.js";
import { AuditLogController } from "./presentation/audit-log.controller.js";
import { buildAuditLogRouter } from "./presentation/audit-log.router.js";

export { registerAuditModels } from "./infrastructure/register-audit-models.js";
export { auditManifest } from "./module.manifest.js";

/** The kernel `AuditRecorder` port. routes/v1.ts builds it once and hands it to the modules that audit their changes. */
export function buildAuditRecorder(clock: Clock): AuditRecorder {
  return new MongoAuditRecorder(clock);
}

export interface AuditTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
}

/** `GET /orgs/{organizationId}/audit-logs`, mounted by routes/v1.ts behind the tenant pipeline. */
export function buildAuditTenantRouter(dependencies: AuditTenantRouterDependencies): Router {
  const controller = new AuditLogController({
    listAuditLogs: new ListAuditLogsUseCase({ auditLogs: new MongoAuditLogRepository() }),
  });
  return buildAuditLogRouter(controller, dependencies.permission);
}
