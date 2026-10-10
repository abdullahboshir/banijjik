import type { Logger } from "pino";
import type { AppConfig } from "./config/index.js";
import { createCloseDatabasesTask, type DatabaseConnections } from "./kernel/db/index.js";
import { eventHandlerRegistry, startEventProcessing } from "./kernel/events/index.js";
import type { ShutdownTask } from "./kernel/lifecycle/shutdown.js";
import { createCloseRedisTask, createQueueRedisClient } from "./kernel/redis/index.js";
import { buildEventModuleEffectiveness } from "./routes/module-effectiveness.js";
import { systemClock } from "./kernel/time/index.js";

/**
 * Starts the worker role: the outbox dispatcher and the BullMQ worker (ADR-090). Returns the
 * shutdown tasks in the order they must run: stop the dispatcher, close the worker, close the
 * queue, close Redis, close the databases. The worker starts even when Redis is away; the
 * dispatcher then keeps events pending and backs off until it returns.
 */
export function startWorker(
  config: AppConfig,
  logger: Logger,
  connections: DatabaseConnections,
): readonly ShutdownTask[] {
  const redis = createQueueRedisClient(config.redisUrl);
  const processing = startEventProcessing({
    redis,
    registry: eventHandlerRegistry,
    effectiveness: buildEventModuleEffectiveness(systemClock),
    clock: systemClock,
    ...(config.outboxPollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: config.outboxPollIntervalMs }),
  });
  logger.info({ event: "worker.started" }, "worker started");
  return [
    ...processing.shutdownTasks,
    createCloseRedisTask(redis),
    createCloseDatabasesTask(connections),
  ];
}
