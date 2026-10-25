import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { EventHandler } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { DailyReportUseCase } from "./application/daily.use-case.js";
import { HomeReportUseCase } from "./application/home.use-case.js";
import { buildSummarizeEventHandler } from "./application/summarize-event.handler.js";
import type {
  DailySummaryWriter,
  OrganizationLocalSettings,
  ReportSourceReader,
} from "./application/ports/report-ports.js";
import {
  MongoDailySummaryRepository,
  MongoReportEventMarkerRepository,
} from "./infrastructure/mongo-report.repositories.js";
import { ReportController } from "./presentation/report.controller.js";
import { buildReportTenantRouter } from "./presentation/report-tenant.router.js";

export { reportManifest } from "./module.manifest.js";
export { registerReportModels } from "./infrastructure/register-report-models.js";
export type {
  BookingFact,
  ExpenseFact,
  OrderFact,
  OrganizationLocalSettings,
  PaymentFact,
  ReportSourceReader,
  SalesReturnFact,
} from "./application/ports/report-ports.js";

export interface ReportTenantDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: Pick<OrgConfigService, "isModuleEffective">;
  readonly settings: OrganizationLocalSettings;
  readonly clock: Clock;
}

/** The daily-row writer, for tests and the rebuild card that seed or repair rows through the same path. */
export function buildDailySummaryWriter(): DailySummaryWriter {
  return new MongoDailySummaryRepository();
}

export function buildReportRouter(dependencies: ReportTenantDependencies): Router {
  const rows = new MongoDailySummaryRepository();
  const controller = new ReportController({
    home: new HomeReportUseCase({
      rows,
      settings: dependencies.settings,
      orgConfig: dependencies.orgConfig,
      clock: dependencies.clock,
    }),
    daily: new DailyReportUseCase({ rows, settings: dependencies.settings }),
  });
  return buildReportTenantRouter({ controller, permission: dependencies.permission });
}

/** The worker's handler: it counts the events of every source module into the daily rows. */
export function buildReportEventHandler(dependencies: {
  readonly reader: ReportSourceReader;
  readonly settings: OrganizationLocalSettings;
  readonly clock: Clock;
}): EventHandler {
  return buildSummarizeEventHandler({
    reader: dependencies.reader,
    settings: dependencies.settings,
    markers: new MongoReportEventMarkerRepository(),
    summaries: new MongoDailySummaryRepository(),
    clock: dependencies.clock,
  });
}
