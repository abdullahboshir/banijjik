import type { Logger } from "pino";
import type { AppConfig } from "./config/index.js";
import { createCloseDatabasesTask, type DatabaseConnections } from "./kernel/db/index.js";
import { eventHandlerRegistry, startEventProcessing } from "./kernel/events/index.js";
import type { ShutdownTask } from "./kernel/lifecycle/shutdown.js";
import { createCloseRedisTask, createQueueRedisClient } from "./kernel/redis/index.js";
import { registerBookingScheduledJobs } from "./modules/commerce/booking/index.js";
import { startScheduledJobs } from "./kernel/jobs/index.js";
import { registerAccountingAndExpenseHandlers } from "./routes/accounting-event-handlers.js";
import { registerContactHandlers } from "./routes/contact-event-handlers.js";
import { buildEventModuleEffectiveness } from "./routes/module-effectiveness.js";
import { buildModuleRegistry } from "./routes/module-registry.js";
import { systemClock } from "./kernel/time/index.js";
import { buildOrgConfigService } from "./modules/platform/entitlement/index.js";
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
export function startWorker(
  config: AppConfig,
  logger: Logger,
  connections: DatabaseConnections,
): readonly ShutdownTask[] {
  const redis = createQueueRedisClient(config.redisUrl);
  registerContactHandlers(config);
  registerAccountingAndExpenseHandlers();
  const registry: ModuleRegistry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: systemClock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(systemClock),
  });
  registerBookingScheduledJobs({
    clock: systemClock,
    orgConfig,
    manifests: registry.all(),
  });
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
