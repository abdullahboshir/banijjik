import { OUTBOX_STATUS } from "@banijjik/contracts";
import { models } from "../db/index.js";
import { summarizeError } from "./error-summary.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const FINAL_BACKOFF_MS = 60 * MILLISECONDS_PER_MINUTE;
/** 5 s, 30 s, 2 min, 10 min, then 1 h for every later failure (ported from manoxen). */
export const DISPATCH_BACKOFF_MS: readonly number[] = [
  5 * MILLISECONDS_PER_SECOND,
  30 * MILLISECONDS_PER_SECOND,
  2 * MILLISECONDS_PER_MINUTE,
  10 * MILLISECONDS_PER_MINUTE,
];
export const CLAIM_LOCK_MS = 30 * MILLISECONDS_PER_SECOND;
/** The tenth failed dispatch makes an event DEAD: it is no longer claimed and is reported once (review M12). */
export const MAX_DISPATCH_ATTEMPTS = 10;

function outbox() {
  return models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
}

/**
 * Takes one due event for this dispatcher. The claim is one atomic update that sets `lockedUntil`,
 * so two dispatchers never hold the same event; a dispatcher that dies loses its claim after the
 * lock time and the event is picked up again (the deduplicated job IDs make that safe).
 */
export async function claimNextEvent(now: Date): Promise<OutboxEventDocument | null> {
  return outbox()
    .findOneAndUpdate(
      {
        status: OUTBOX_STATUS.PENDING,
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      { $set: { lockedUntil: new Date(now.getTime() + CLAIM_LOCK_MS) } },
      { sort: { nextAttemptAt: 1, streamSequence: 1 }, returnDocument: "after" },
    )
    .lean<OutboxEventDocument>();
}

/** Only a still-pending event is marked, so a late call can never revive or overwrite another state. */
export async function markDispatched(eventId: string, now: Date): Promise<void> {
  await outbox().updateOne(
    { eventId, status: OUTBOX_STATUS.PENDING },
    { $set: { status: OUTBOX_STATUS.DISPATCHED, dispatchedAt: now, lockedUntil: null } },
  );
}

/** Pure, so the schedule is testable without a clock: delay before the next try after `attemptsSoFar` failures. */
export function dispatchBackoffMs(attemptsSoFar: number): number {
  return DISPATCH_BACKOFF_MS[attemptsSoFar] ?? FINAL_BACKOFF_MS;
}

/** The event stays PENDING and is tried again after the backoff. */
export async function scheduleRetry(
  event: OutboxEventDocument,
  now: Date,
  error: unknown,
): Promise<void> {
  const nextAttemptAt = new Date(now.getTime() + dispatchBackoffMs(event.dispatchAttempts));
  await outbox().updateOne(
    { eventId: event.eventId, status: OUTBOX_STATUS.PENDING },
    {
      $inc: { dispatchAttempts: 1 },
      $set: { nextAttemptAt, lockedUntil: null, lastError: summarizeError(error) },
    },
  );
}

/**
 * The event can never be dispatched: it leaves the queue of pending work for good, so it stops
 * costing a claim every hour. Only a still-pending event is changed, like every other transition.
 */
export async function markDead(event: OutboxEventDocument, error: unknown): Promise<void> {
  await outbox().updateOne(
    { eventId: event.eventId, status: OUTBOX_STATUS.PENDING },
    {
      $inc: { dispatchAttempts: 1 },
      $set: { status: OUTBOX_STATUS.DEAD, lockedUntil: null, lastError: summarizeError(error) },
    },
  );
}
