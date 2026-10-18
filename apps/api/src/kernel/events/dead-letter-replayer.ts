import { EVENT_DEAD_LETTER_STATUS } from "@banijjik/contracts";
import type { Queue } from "bullmq";
import { models } from "../db/index.js";
import { getLogger } from "../logger/index.js";
import { reportError } from "../observability/report-error.js";
import { systemClock } from "../time/index.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import { buildEventJobId, type EventJobData, type EventJobQueue } from "./event-job.js";

export const DEFAULT_REPLAY_POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 20;

export interface DeadLetterReplayerOptions {
  readonly queue: Queue<EventJobData>;
  readonly jobs: EventJobQueue;
  readonly pollIntervalMs?: number;
}

function deadLetters() {
  return models({}).get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME);
}

/**
 * Carries out the replays an operator asked for (ADR-115): the failed BullMQ job of the same ID is
 * removed and a new one with fresh attempts is added. It runs in the worker role next to the
 * dispatcher, so the API process never opens a queue connection (external effects stay in the worker).
 */
export class DeadLetterReplayer {
  private readonly pollIntervalMs: number;
  private isRunning = false;
  private timer: NodeJS.Timeout | undefined;
  private currentTick: Promise<void> | undefined;

  constructor(private readonly options: DeadLetterReplayerOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_REPLAY_POLL_INTERVAL_MS;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleTick(0);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    clearTimeout(this.timer);
    await this.currentTick;
  }

  /** Queues every replay that was requested. Returns how many it queued. */
  async replayPending(): Promise<number> {
    const rows = await deadLetters()
      .find({ status: EVENT_DEAD_LETTER_STATUS.REPLAY_REQUESTED })
      .limit(BATCH_SIZE)
      .lean<EventDeadLetterDocument[]>();
    let queued = 0;
    for (const row of rows) {
      if (await this.tryRequeue(row)) queued += 1;
    }
    return queued;
  }

  /**
   * Re-adds the job, then (and only then) says REPLAYED. A failure is reported and the row stays
   * REPLAY_REQUESTED, so the next poll tries again; one bad row never stops the others.
   */
  private async tryRequeue(row: EventDeadLetterDocument): Promise<boolean> {
    try {
      await this.requeue(row);
      return true;
    } catch (error) {
      reportError(error, { eventId: row.eventId, handlerKey: row.handlerKey });
      getLogger().error(
        {
          event: "events.dead_letter_replay_failed",
          eventId: row.eventId,
          handlerKey: row.handlerKey,
        },
        "failed event handler could not be queued again, will retry",
      );
      return false;
    }
  }

  private async requeue(row: EventDeadLetterDocument): Promise<void> {
    const jobId = buildEventJobId(row.eventId, row.handlerKey);
    const old = await this.options.queue.getJob(jobId);
    // A job that is running or waiting is not removed: it will run, and a second one would repeat it.
    if (old !== undefined && (await old.isFailed())) await old.remove();
    await this.options.jobs.enqueue({
      eventId: row.eventId,
      handlerKey: row.handlerKey,
      type: row.type,
      organizationId: row.organizationId ?? null,
    });
    await deadLetters().updateOne(
      {
        eventDeadLetterId: row.eventDeadLetterId,
        status: EVENT_DEAD_LETTER_STATUS.REPLAY_REQUESTED,
      },
      { $set: { status: EVENT_DEAD_LETTER_STATUS.REPLAYED, requeuedAt: systemClock.now() } },
    );
    getLogger().info(
      { event: "events.dead_letter_replayed", eventId: row.eventId, handlerKey: row.handlerKey },
      "failed event handler queued again",
    );
  }

  private scheduleTick(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.currentTick = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    try {
      await this.replayPending();
    } catch (error) {
      // The database or Redis was away: report it and try again on the next tick.
      reportError(error, {});
    }
    if (this.isRunning) this.scheduleTick(this.pollIntervalMs);
  }
}
