import { DelayedError, Worker, type Job } from "bullmq";
import { getLogger } from "../logger/index.js";
import type { RedisClient } from "../redis/index.js";
import { deadLetter } from "./dead-letter.js";
import type { EventHandlerRegistry } from "./event-handler-registry.js";
import { EVENT_QUEUE_NAME, type EventJobData } from "./event-job.js";
import { runEventHandler } from "./handler-runner.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import { findStreamOf } from "./stream-of-event.js";

export const WORKER_CONCURRENCY = 5;
/** First wait of a job that is ahead of its stream; it doubles up to the cap below (ADR-115). */
export const STREAM_WAIT_BASE_DELAY_MS = 1000;
export const STREAM_WAIT_MAX_DELAY_MS = 60_000;
/** After this long a waiting job is reported (a stuck stream must be visible), then about once an hour. */
export const STREAM_WAIT_WARN_AFTER_MS = 24 * 60 * 60 * 1000;
const WARN_EVERY_N_WAITS = Math.ceil((60 * 60 * 1000) / STREAM_WAIT_MAX_DELAY_MS);

export interface EventWorkerOptions {
  readonly connection: RedisClient;
  readonly registry: EventHandlerRegistry;
  /** Decides whether a handler's module is on for the event's organization. */
  readonly effectiveness: ModuleEffectiveness;
  /** Must equal the queue's prefix. Tests give every run its own. */
  readonly prefix?: string;
  /** First wait of a job that is ahead of its stream. Tests shorten it. */
  readonly streamWaitBaseDelayMs?: number;
}

type ProcessDependencies = Pick<EventWorkerOptions, "registry" | "effectiveness"> & {
  readonly streamWaitBaseDelayMs: number;
};

/**
 * How many real failures the job had: a job that waited for its stream is picked up again, and
 * BullMQ 6.3.12 counts that pickup in `attemptsStarted` but not in `attemptsMade` (probed in card
 * 3.8a). Only `attemptsMade` is the number of failed attempts, so a waiting job never spends one.
 */
function failedAttempts(job: Job<EventJobData>): number {
  return job.attemptsMade;
}

function isFinalAttempt(job: Job<EventJobData>): boolean {
  // The attempt that is running now is one more than the failures so far.
  return failedAttempts(job) + 1 >= (job.opts.attempts ?? 1);
}

async function recordFailure(
  job: Job<EventJobData>,
  error: unknown,
  registry: EventHandlerRegistry,
) {
  if (isFinalAttempt(job)) {
    const stream = await findStreamOf(job.data, registry);
    await deadLetter({
      data: job.data,
      attempts: failedAttempts(job) + 1,
      error,
      ...(stream === undefined ? {} : { stream }),
    });
    return;
  }
  getLogger().warn(
    {
      event: "events.handler_failed",
      eventId: job.data.eventId,
      handlerKey: job.data.handlerKey,
      attempt: failedAttempts(job) + 1,
    },
    "event handler failed, will retry",
  );
}

/**
 * Puts a job that is ahead of its stream back in the queue after a short, growing wait. It is not a
 * failure: `moveToDelayed` plus `DelayedError` leaves `attemptsMade` alone (ADR-115).
 */
async function waitForEarlierEvent(
  job: Job<EventJobData>,
  token: string | undefined,
  baseDelayMs: number,
): Promise<never> {
  const waitsSoFar = Math.max(0, job.attemptsStarted - failedAttempts(job) - 1);
  const delayMs = Math.min(baseDelayMs * 2 ** waitsSoFar, STREAM_WAIT_MAX_DELAY_MS);
  const waitedMs = Date.now() - job.timestamp;
  if (waitedMs >= STREAM_WAIT_WARN_AFTER_MS && waitsSoFar % WARN_EVERY_N_WAITS === 0) {
    getLogger().warn(
      {
        event: "events.stream_waiting",
        eventId: job.data.eventId,
        handlerKey: job.data.handlerKey,
        waitedMs,
      },
      "event stream is waiting for an earlier event",
    );
  }
  await job.moveToDelayed(Date.now() + delayMs, token);
  throw new DelayedError();
}

/**
 * The shared wrapper of every handler: run it; on the last failed attempt dead-letter it, then rethrow;
 * an ORDERED handler that is ahead of its stream waits without failing.
 */
async function processJob(
  job: Job<EventJobData>,
  token: string | undefined,
  dependencies: ProcessDependencies,
): Promise<void> {
  const { registry, effectiveness } = dependencies;
  let result;
  try {
    result = await runEventHandler(job.data, registry, effectiveness);
  } catch (error) {
    await recordFailure(job, error, registry);
    throw error;
  }
  if (result === "WAITING_FOR_EARLIER_EVENT") {
    await waitForEarlierEvent(job, token, dependencies.streamWaitBaseDelayMs);
  }
}

/** Runs the handlers of dispatched events, five at a time. Only the worker role creates it. */
export function createEventWorker(options: EventWorkerOptions): Worker<EventJobData> {
  const dependencies = {
    registry: options.registry,
    effectiveness: options.effectiveness,
    streamWaitBaseDelayMs: options.streamWaitBaseDelayMs ?? STREAM_WAIT_BASE_DELAY_MS,
  };
  const worker = new Worker<EventJobData>(
    EVENT_QUEUE_NAME,
    (job, token) => processJob(job, token, dependencies),
    {
      connection: options.connection,
      concurrency: WORKER_CONCURRENCY,
      ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
    },
  );
  // Without a listener an "error" event (Redis away) would end the process.
  worker.on("error", () => {
    getLogger().debug({ event: "events.worker_error" }, "event worker error");
  });
  return worker;
}
