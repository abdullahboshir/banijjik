import { Worker, type Job } from "bullmq";
import { getLogger } from "../logger/index.js";
import type { RedisClient } from "../redis/index.js";
import { deadLetter } from "./dead-letter.js";
import type { EventHandlerRegistry } from "./event-handler-registry.js";
import { EVENT_QUEUE_NAME, type EventJobData } from "./event-job.js";
import { runEventHandler } from "./handler-runner.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";

export const WORKER_CONCURRENCY = 5;

export interface EventWorkerOptions {
  readonly connection: RedisClient;
  readonly registry: EventHandlerRegistry;
  /** Decides whether a handler's module is on for the event's organization. */
  readonly effectiveness: ModuleEffectiveness;
  /** Must equal the queue's prefix. Tests give every run its own. */
  readonly prefix?: string;
}

function isFinalAttempt(job: Job<EventJobData>): boolean {
  // attemptsStarted counts the attempt that is running now.
  return job.attemptsStarted >= (job.opts.attempts ?? 1);
}

/** The shared wrapper of every handler: run it, and on the last failed attempt dead-letter it, then rethrow. */
async function processJob(
  job: Job<EventJobData>,
  dependencies: Pick<EventWorkerOptions, "registry" | "effectiveness">,
): Promise<void> {
  try {
    await runEventHandler(job.data, dependencies.registry, dependencies.effectiveness);
  } catch (error) {
    if (isFinalAttempt(job)) {
      await deadLetter({ data: job.data, attempts: job.attemptsStarted, error });
    } else {
      getLogger().warn(
        {
          event: "events.handler_failed",
          eventId: job.data.eventId,
          handlerKey: job.data.handlerKey,
          attempt: job.attemptsStarted,
        },
        "event handler failed, will retry",
      );
    }
    throw error;
  }
}

/** Runs the handlers of dispatched events, five at a time. Only the worker role creates it. */
export function createEventWorker(options: EventWorkerOptions): Worker<EventJobData> {
  const worker = new Worker<EventJobData>(EVENT_QUEUE_NAME, (job) => processJob(job, options), {
    connection: options.connection,
    concurrency: WORKER_CONCURRENCY,
    ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
  });
  // Without a listener an "error" event (Redis away) would end the process.
  worker.on("error", () => {
    getLogger().debug({ event: "events.worker_error" }, "event worker error");
  });
  return worker;
}
