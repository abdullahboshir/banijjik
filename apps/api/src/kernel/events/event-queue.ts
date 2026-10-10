import { Queue } from "bullmq";
import { getLogger } from "../logger/index.js";
import type { RedisClient } from "../redis/index.js";
import { withTimeout } from "../time/index.js";
import {
  buildEventJobId,
  EVENT_QUEUE_NAME,
  type EventJobData,
  type EventJobQueue,
} from "./event-job.js";

export const EVENT_JOB_ATTEMPTS = 5;
const COMPLETED_JOBS_KEPT = 1000;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_ENQUEUE_TIMEOUT_MS = 5000;

export interface EventQueueOptions {
  readonly connection: RedisClient;
  /** Key prefix of the queue in Redis. Tests give every run its own. */
  readonly prefix?: string;
}

export function createEventQueue(options: EventQueueOptions): Queue<EventJobData> {
  const queue = new Queue<EventJobData>(EVENT_QUEUE_NAME, {
    connection: options.connection,
    ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
  });
  // Without a listener an "error" event (Redis away) would end the process.
  queue.on("error", () => {
    getLogger().debug({ event: "events.queue_error" }, "event queue error");
  });
  return queue;
}

export interface BullMqEventJobQueueOptions {
  readonly queue: Queue<EventJobData>;
  /** First retry delay; it doubles for each later attempt (1 s, 2 s, 4 s, 8 s). */
  readonly retryBaseDelayMs?: number;
  /** A Redis that is away makes `add` wait forever, so the dispatcher gives up after this long. */
  readonly enqueueTimeoutMs?: number;
}

/** Adds one job per handler, with the retry policy of ADR-090. */
export class BullMqEventJobQueue implements EventJobQueue {
  constructor(private readonly options: BullMqEventJobQueueOptions) {}

  async enqueue(job: EventJobData): Promise<void> {
    const { queue, retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS } = this.options;
    const timeoutMs = this.options.enqueueTimeoutMs ?? DEFAULT_ENQUEUE_TIMEOUT_MS;
    const adding = queue.add(job.handlerKey, job, {
      jobId: buildEventJobId(job.eventId, job.handlerKey),
      attempts: EVENT_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: retryBaseDelayMs },
      removeOnComplete: COMPLETED_JOBS_KEPT,
      removeOnFail: false,
    });
    await withTimeout(adding, timeoutMs, () => new Error("event queue add timed out"));
  }
}
