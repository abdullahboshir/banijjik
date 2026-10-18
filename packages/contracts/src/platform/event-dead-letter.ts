import { defineEnum } from "../define-enum.js";

/**
 * Where a dead-lettered handler job stands (card 3.8a, ADR-115). FAILED waits for an operator.
 * REPLAY_REQUESTED means an operator asked for a replay and the worker has not queued the job again yet
 * (the API says nothing is replayed until it is). REPLAYED means the job was queued again. SKIPPED means an operator gave up on it with a reason,
 * so the handler's effect never happened and must be fixed by hand.
 */
export const EVENT_DEAD_LETTER_STATUS = defineEnum([
  "FAILED",
  "REPLAY_REQUESTED",
  "REPLAYED",
  "SKIPPED",
]);

export type EventDeadLetterStatus =
  (typeof EVENT_DEAD_LETTER_STATUS)[keyof typeof EVENT_DEAD_LETTER_STATUS];

/** One row of `GET /platform/event-dead-letters`: a handler that failed its last attempt on one event. */
export interface PlatformDeadLetter {
  eventDeadLetterId: string;
  eventId: string;
  handlerKey: string;
  eventType: string;
  organizationId: string | null;
  status: EventDeadLetterStatus;
  attempts: number;
  /** Error class and code only: a driver message can carry user data. */
  lastError: string;
  failedAt: string;
  /** Set when the handler is ORDERED: its stream waits behind this row until it is replayed or skipped. */
  orderingKey?: string;
  streamSequence?: number;
  resolvedAt?: string;
  resolutionReason?: string;
}

/** One row of `GET /platform/dead-outbox-events`: an event that could not be handed to the queue. */
export interface PlatformDeadOutboxEvent {
  eventId: string;
  eventType: string;
  organizationId: string | null;
  dispatchAttempts: number;
  lastError: string | null;
  occurredAt: string;
}
