import type { Worker } from "bullmq";
import type { ShutdownTask } from "../lifecycle/shutdown.js";
import type { RedisClient } from "../redis/index.js";
import type { Clock } from "../time/index.js";
import type { EventHandlerRegistry } from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import { BullMqEventJobQueue, createEventQueue } from "./event-queue.js";
import { createEventWorker } from "./event-worker.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import { DeadLetterReplayer } from "./dead-letter-replayer.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";

export interface EventProcessingOptions {
  readonly redis: RedisClient;
  readonly registry: EventHandlerRegistry;
  /** A handler runs only while its module is effective for the event's organization. */
  readonly effectiveness: ModuleEffectiveness;
  readonly clock: Clock;
  readonly pollIntervalMs?: number;
  /** Redis key prefix of the queue. Tests use their own; production uses the BullMQ default. */
  readonly queuePrefix?: string;
  /** First retry delay of a failed handler. Tests shorten it. */
  readonly retryBaseDelayMs?: number;
  /** First wait of a job that is ahead of its stream (ADR-115). Tests shorten it. */
  readonly streamWaitBaseDelayMs?: number;
}

export interface EventProcessing {
  readonly dispatcher: OutboxDispatcher;
  readonly replayer: DeadLetterReplayer;
  readonly worker: Worker<EventJobData>;
  /** Stops the dispatcher, then the worker, then the queue. The caller adds Redis and the databases after them. */
  readonly shutdownTasks: readonly ShutdownTask[];
}

/**
 * Starts the event side of the worker role: seals the handler registry, then runs the dispatcher
 * and the BullMQ worker (ADR-090). The order of the shutdown tasks matters: nothing new is
 * enqueued while the worker finishes its running jobs.
 */
export function startEventProcessing(options: EventProcessingOptions): EventProcessing {
  const { redis, registry, clock } = options;
  const prefix = options.queuePrefix === undefined ? {} : { prefix: options.queuePrefix };
  registry.seal();
  const queue = createEventQueue({ connection: redis, ...prefix });
  const worker = createEventWorker({
    connection: redis,
    registry,
    effectiveness: options.effectiveness,
    ...(options.streamWaitBaseDelayMs === undefined
      ? {}
      : { streamWaitBaseDelayMs: options.streamWaitBaseDelayMs }),
    ...prefix,
  });
  const jobs = new BullMqEventJobQueue({
    queue,
    ...(options.retryBaseDelayMs === undefined
      ? {}
      : { retryBaseDelayMs: options.retryBaseDelayMs }),
  });
  const replayer = new DeadLetterReplayer({
    queue,
    jobs,
    ...(options.pollIntervalMs === undefined ? {} : { pollIntervalMs: options.pollIntervalMs }),
  });
  const dispatcher = new OutboxDispatcher({
    queue: jobs,
    registry,
    clock,
    ...(options.pollIntervalMs === undefined ? {} : { pollIntervalMs: options.pollIntervalMs }),
  });
  dispatcher.start();
  replayer.start();
  return {
    dispatcher,
    replayer,
    worker,
    shutdownTasks: [
      { name: "stop-dispatcher", run: () => dispatcher.stop() },
      { name: "stop-replayer", run: () => replayer.stop() },
      { name: "close-worker", run: () => worker.close() },
      { name: "close-queue", run: () => queue.close() },
    ],
  };
}
