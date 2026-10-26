import { registerEnrollmentWorkerJobs } from "./routes/enrollment-worker-jobs.js";
import type { Logger } from "pino";
import type { AppConfig } from "./config/index.js";
import { createCloseDatabasesTask, type DatabaseConnections } from "./kernel/db/index.js";
import { eventHandlerRegistry, startEventProcessing } from "./kernel/events/index.js";
import type { ShutdownTask } from "./kernel/lifecycle/shutdown.js";
import { createCloseRedisTask, createQueueRedisClient } from "./kernel/redis/index.js";
import { registerBookingScheduledJobs } from "./modules/commerce/booking/index.js";
import { registerCreditScheduledJobs } from "./modules/commerce/credit/index.js";
import { registerPaymentScheduledJobs } from "./modules/commerce/payment/index.js";
import { registerSalesScheduledJobs } from "./modules/commerce/sales/index.js";
import { buildBookingDepositCheckAdapter } from "./routes/booking-deposit-adapter.js";
import { buildSalesJobPortsForWorker } from "./routes/sales-tenant-router.js";
import { buildAuditRecorder } from "./modules/core/audit/index.js";
import { startScheduledJobs } from "./kernel/jobs/index.js";
import { registerAccountingAndExpenseHandlers } from "./routes/accounting-event-handlers.js";
import { registerReportEventHandlers } from "./routes/report-event-handlers.js";
import { registerCommissionHandlers } from "./routes/commission-adapters.js";
import { registerContactHandlers } from "./routes/contact-event-handlers.js";
import { registerDirectoryReviewSmsHandler } from "./routes/directory-event-handlers.js";
import {
  registerDirectoryEventHandlers,
  registerDirectoryStatsHandler,
} from "./modules/commerce/directory/index.js";
import { buildDirectoryBlockReader } from "./modules/platform/industry/index.js";
import { buildEventModuleEffectiveness } from "./routes/module-effectiveness.js";
import { buildModuleRegistry } from "./routes/module-registry.js";
import { systemClock } from "./kernel/time/index.js";
import {
  buildOrgConfigService,
  type OrgConfigService,
} from "./modules/platform/entitlement/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "./routes/organization-config-ports.js";
import { buildIndustryTemplateReader } from "./modules/platform/industry/index.js";
import type { ModuleRegistry } from "./kernel/modules/index.js";

/**
 * Starts the worker role: the scheduled jobs, the outbox dispatcher and the BullMQ worker
 * (ADR-090, ADR-122). Returns the shutdown tasks in the order they must run: close the scheduled
 * jobs worker and queue, stop the dispatcher, close the worker, close the queue, close Redis,
 * close the databases. The worker starts even when Redis is away; the dispatcher then keeps
 * events pending and backs off until it returns.
 */
interface WorkerOrgConfig {
  readonly registry: ModuleRegistry;
  readonly orgConfig: OrgConfigService;
}

function buildWorkerOrgConfig(): WorkerOrgConfig {
  const registry: ModuleRegistry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: systemClock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(systemClock),
  });
  return { registry, orgConfig };
}

export function startWorker(
  config: AppConfig,
  logger: Logger,
  connections: DatabaseConnections,
): readonly ShutdownTask[] {
  const redis = createQueueRedisClient(config.redisUrl);
  registerContactHandlers(config);
  registerAccountingAndExpenseHandlers();
  registerReportEventHandlers(systemClock);
  registerDirectoryEventHandlers({ clock: systemClock, audit: buildAuditRecorder(systemClock) });
  registerDirectoryStatsHandler(buildDirectoryBlockReader());
  const { registry, orgConfig } = buildWorkerOrgConfig();
  registerDirectoryReviewSmsHandler({
    clock: systemClock,
    smsDriver: config.storefront.smsDriver,
    orgConfig,
    manifests: registry.all(),
  });
  registerCommissionHandlers(systemClock, orgConfig);
  registerBookingScheduledJobs({
    clock: systemClock,
    orgConfig,
    manifests: registry.all(),
    depositCheck: buildBookingDepositCheckAdapter(),
    audit: buildAuditRecorder(systemClock),
  });
  registerCreditScheduledJobs({ clock: systemClock, audit: buildAuditRecorder(systemClock) });
  registerPaymentScheduledJobs({
    clock: systemClock,
    orgConfig,
  });
  registerSalesScheduledJobs(
    buildSalesJobPortsForWorker({
      clock: systemClock,
      audit: buildAuditRecorder(systemClock),
      orgConfig,
      manifests: registry.all(),
    }),
  );
  registerEnrollmentWorkerJobs({ clock: systemClock, orgConfig, registry });
  const effectiveness = buildEventModuleEffectiveness(systemClock);
  const scheduledJobs = startScheduledJobs({ redis, effectiveness, clock: systemClock });
  const processing = startEventProcessing({
    redis,
    registry: eventHandlerRegistry,
    effectiveness,
    clock: systemClock,
    ...(config.outboxPollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: config.outboxPollIntervalMs }),
  });
  logger.info({ event: "worker.started" }, "worker started");
  return [
    ...scheduledJobs.shutdownTasks,
    ...processing.shutdownTasks,
    createCloseRedisTask(redis),
    createCloseDatabasesTask(connections),
  ];
}
