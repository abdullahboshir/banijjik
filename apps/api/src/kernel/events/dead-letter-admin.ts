import {
  EVENT_DEAD_LETTER_STATUS,
  OUTBOX_STATUS,
  type PlatformDeadLetter,
  type PlatformDeadOutboxEvent,
} from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../db/index.js";
import { systemClock } from "../time/index.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
  type EventDeadLetterStatus,
} from "./dead-letter.schema.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";
import { advancePosition, readPosition } from "./stream-position.js";

/**
 * What an operator may do with events that did not get through (card 3.8a, ADR-115). These functions
 * only write to the database, inside the caller's transaction: a replay is a request that the worker
 * carries out (see `dead-letter-replayer.ts`), so the API process never talks to the queue.
 */

export interface DeadLetterPage {
  readonly items: PlatformDeadLetter[];
  readonly hasNext: boolean;
}

export interface DeadOutboxPage {
  readonly items: PlatformDeadOutboxEvent[];
  readonly hasNext: boolean;
}

export interface PageQuery {
  readonly page: number;
  readonly limit: number;
}

function deadLetters() {
  return models({}).get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME);
}

function outbox() {
  return models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
}

function toDeadLetter(row: EventDeadLetterDocument): PlatformDeadLetter {
  return {
    eventDeadLetterId: row.eventDeadLetterId,
    eventId: row.eventId,
    handlerKey: row.handlerKey,
    eventType: row.type,
    organizationId: row.organizationId ?? null,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    failedAt: row.failedAt.toISOString(),
    ...(row.orderingKey === null || row.orderingKey === undefined
      ? {}
      : { orderingKey: row.orderingKey }),
    ...(row.streamSequence === null || row.streamSequence === undefined
      ? {}
      : { streamSequence: row.streamSequence }),
    ...(row.resolvedAt === null || row.resolvedAt === undefined
      ? {}
      : { resolvedAt: row.resolvedAt.toISOString() }),
    ...(row.resolutionReason === null || row.resolutionReason === undefined
      ? {}
      : { resolutionReason: row.resolutionReason }),
  };
}

/** Newest failure first. One extra row tells whether another page exists. */
export async function listDeadLetters(input: {
  readonly status?: EventDeadLetterStatus | undefined;
  readonly page: PageQuery;
}): Promise<DeadLetterPage> {
  const { page, limit } = input.page;
  const rows = await deadLetters()
    .find(input.status === undefined ? {} : { status: input.status })
    .sort({ failedAt: -1, eventDeadLetterId: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean<EventDeadLetterDocument[]>();
  return { items: rows.slice(0, limit).map(toDeadLetter), hasNext: rows.length > limit };
}

/** Events that could not be handed to the queue after every attempt (OUTBOX_STATUS.DEAD), oldest first. */
export async function listDeadOutboxEvents(page: PageQuery): Promise<DeadOutboxPage> {
  const rows = await outbox()
    .find({ status: OUTBOX_STATUS.DEAD })
    .sort({ occurredAt: 1, eventId: 1 })
    .skip((page.page - 1) * page.limit)
    .limit(page.limit + 1)
    .lean<OutboxEventDocument[]>();
  const items = rows.slice(0, page.limit).map((row) => ({
    eventId: row.eventId,
    eventType: row.type,
    organizationId: row.organizationId,
    dispatchAttempts: row.dispatchAttempts,
    lastError: row.lastError,
    occurredAt: row.occurredAt.toISOString(),
  }));
  return { items, hasNext: rows.length > page.limit };
}

export type DeadLetterAction =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "NOT_FAILED" }
  /** SKIP of an ORDERED handler whose position is not right before this event: earlier events are unhandled. */
  | { readonly kind: "STREAM_NOT_AT_EVENT" }
  | {
      readonly kind: "DONE";
      readonly before: PlatformDeadLetter;
      readonly after: PlatformDeadLetter;
    };

async function findDeadLetter(eventDeadLetterId: string): Promise<EventDeadLetterDocument | null> {
  return deadLetters()
    .findOne({ eventDeadLetterId }, null, sessionOption(getActiveSession()))
    .lean<EventDeadLetterDocument>();
}

/**
 * Asks for a failed handler job to be queued again with fresh attempts. Nothing is replayed yet: the
 * status is REPLAY_REQUESTED (with who and when) until the worker's replayer has added the job.
 */
export async function replayDeadLetter(input: {
  readonly eventDeadLetterId: string;
  readonly operatorId: string;
}): Promise<DeadLetterAction> {
  const row = await findDeadLetter(input.eventDeadLetterId);
  if (row === null) return { kind: "NOT_FOUND" };
  if (row.status !== EVENT_DEAD_LETTER_STATUS.FAILED) return { kind: "NOT_FAILED" };
  const result = await deadLetters()
    .findOneAndUpdate(
      { eventDeadLetterId: input.eventDeadLetterId, status: EVENT_DEAD_LETTER_STATUS.FAILED },
      {
        $set: {
          status: EVENT_DEAD_LETTER_STATUS.REPLAY_REQUESTED,
          resolvedAt: systemClock.now(),
          resolvedByPlatformOperatorId: input.operatorId,
          requeuedAt: null,
        },
      },
      { returnDocument: "after", ...sessionOption(getActiveSession()) },
    )
    .lean<EventDeadLetterDocument>();
  if (result === null) return { kind: "NOT_FAILED" };
  return { kind: "DONE", before: toDeadLetter(row), after: toDeadLetter(result) };
}

/**
 * Gives up on a failed handler job. For an ORDERED handler the position moves past the event, so the
 * stream continues; that is allowed only when the position is right before it, because jumping over
 * earlier unhandled events would lose them.
 */
export async function skipDeadLetter(input: {
  readonly eventDeadLetterId: string;
  readonly operatorId: string;
  readonly reason: string;
}): Promise<DeadLetterAction> {
  const row = await findDeadLetter(input.eventDeadLetterId);
  if (row === null) return { kind: "NOT_FOUND" };
  if (row.status !== EVENT_DEAD_LETTER_STATUS.FAILED) return { kind: "NOT_FAILED" };
  if (row.orderingKey !== null && row.streamSequence !== null) {
    const key = {
      handlerKey: row.handlerKey,
      organizationId: row.organizationId ?? null,
      orderingKey: row.orderingKey,
    };
    if ((await readPosition(key)) !== row.streamSequence - 1) {
      return { kind: "STREAM_NOT_AT_EVENT" };
    }
    await advancePosition(key, row.streamSequence);
  }
  const result = await deadLetters()
    .findOneAndUpdate(
      { eventDeadLetterId: input.eventDeadLetterId, status: EVENT_DEAD_LETTER_STATUS.FAILED },
      {
        $set: {
          status: EVENT_DEAD_LETTER_STATUS.SKIPPED,
          resolvedAt: systemClock.now(),
          resolvedByPlatformOperatorId: input.operatorId,
          resolutionReason: input.reason,
        },
      },
      { returnDocument: "after", ...sessionOption(getActiveSession()) },
    )
    .lean<EventDeadLetterDocument>();
  if (result === null) return { kind: "NOT_FAILED" };
  return { kind: "DONE", before: toDeadLetter(row), after: toDeadLetter(result) };
}

export type OutboxReplay =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "NOT_DEAD" }
  | { readonly kind: "DONE"; readonly eventType: string; readonly dispatchAttempts: number };

/** A DEAD outbox event goes back to PENDING with its attempts reset, so the dispatcher tries it again. */
export async function replayDeadOutboxEvent(eventId: string): Promise<OutboxReplay> {
  const row = await outbox()
    .findOne({ eventId }, null, sessionOption(getActiveSession()))
    .lean<OutboxEventDocument>();
  if (row === null) return { kind: "NOT_FOUND" };
  if (row.status !== OUTBOX_STATUS.DEAD) return { kind: "NOT_DEAD" };
  const reset = await outbox().updateOne(
    { eventId, status: OUTBOX_STATUS.DEAD },
    {
      $set: {
        status: OUTBOX_STATUS.PENDING,
        dispatchAttempts: 0,
        nextAttemptAt: systemClock.now(),
        lockedUntil: null,
      },
    },
    sessionOption(getActiveSession()),
  );
  if (reset.modifiedCount === 0) return { kind: "NOT_DEAD" };
  return { kind: "DONE", eventType: row.type, dispatchAttempts: row.dispatchAttempts };
}
