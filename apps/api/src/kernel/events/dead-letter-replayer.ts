import { EVENT_DEAD_LETTER_STATUS } from "@banijjik/contracts";
import type { JobState, Queue } from "bullmq";
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

type OldJobState = JobState | "unknown";

/** What the replayer does about the old job of the same ID (the table of card 3.16). */
type RequeueDecision = "ADD" | "REMOVE_THEN_ADD" | "ALREADY_RAN" | "WAIT";

/** How one row ended. Only QUEUED counts as a replay carried out by this call. */
type RequeueOutcome = "QUEUED" | "ALREADY_RAN" | "OLD_JOB_STILL_IN_QUEUE";

/** States in which the old job still holds its job ID and will move on by itself. */
const STILL_IN_QUEUE_STATES: readonly OldJobState[] = [
  "active",
  "waiting",
  "delayed",
  "prioritized",
  "waiting-children",
];

/**
 * BullMQ ignores an `add` whose job ID already exists, so a replay must not be marked REPLAYED while
 * the old job is in the queue. `failed` is the only state that is removed and added again. A state
 * this function does not know (a newer BullMQ) is treated like "still in the queue".
 */
function decideRequeue(state: OldJobState | undefined): RequeueDecision {
  if (state === undefined || state === "unknown") return "ADD";
  if (state === "failed") return "REMOVE_THEN_ADD";
  if (state === "completed") return "ALREADY_RAN";
  return "WAIT";
}

function deadLetters() {
  return models({}).get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME);
}

/**
 * Carries out the replays an operator asked for (ADR-115): the failed BullMQ job of the same ID is
 * removed and a new one with fresh attempts is added. An old job that is still active (the dead letter
 * is written just before BullMQ moves the job to failed) or waiting is left alone, and the replay
 * stays REPLAY_REQUESTED until that job has failed. It runs in the worker role next to the
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
   * Returns true only when this call queued the job.
   */
  private async tryRequeue(row: EventDeadLetterDocument): Promise<boolean> {
    try {
      return (await this.requeue(row)) === "QUEUED";
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

  private async requeue(row: EventDeadLetterDocument): Promise<RequeueOutcome> {
    const jobId = buildEventJobId(row.eventId, row.handlerKey);
    const old = await this.options.queue.getJob(jobId);
    const state: OldJobState | undefined = old === undefined ? undefined : await old.getState();
    const decision = decideRequeue(state);
    if (decision === "WAIT") {
      this.logDeferred(row, state);
      return "OLD_JOB_STILL_IN_QUEUE";
    }
    if (decision === "ALREADY_RAN") {
      await this.markReplayed(row);
      return "ALREADY_RAN";
    }
    if (decision === "REMOVE_THEN_ADD") await old?.remove();
    await this.options.jobs.enqueue({
      eventId: row.eventId,
      handlerKey: row.handlerKey,
      type: row.type,
      organizationId: row.organizationId ?? null,
    });
    await this.markReplayed(row);
    return "QUEUED";
  }

  private logDeferred(row: EventDeadLetterDocument, state: OldJobState | undefined): void {
    const fields = {
      event: "events.dead_letter_replay_deferred",
      eventId: row.eventId,
      handlerKey: row.handlerKey,
      jobState: state,
    };
    const message = "old event job is still in the queue, replay waits for the next poll";
    if (state !== undefined && STILL_IN_QUEUE_STATES.includes(state)) {
      getLogger().debug(fields, message);
      return;
    }
    getLogger().warn(fields, message);
  }

  /** The filter keeps a row that is FAILED again from being overwritten by a late REPLAYED. */
  private async markReplayed(row: EventDeadLetterDocument): Promise<void> {
    await deadLetters().updateOne(
      {
        eventDeadLetterId: row.eventDeadLetterId,
        status: EVENT_DEAD_LETTER_STATUS.REPLAY_REQUESTED,
      },
      { $set: { status: EVENT_DEAD_LETTER_STATUS.REPLAYED, requeuedAt: systemClock.now() } },
    );
    getLogger().info(
      { event: "events.dead_letter_replayed", eventId: row.eventId, handlerKey: row.handlerKey },
      "failed event handler replay done",
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
