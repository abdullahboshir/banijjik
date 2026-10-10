/** The BullMQ queue that carries one job per (event, handler) pair. */
export const EVENT_QUEUE_NAME = "events";

/** Job data stays small: the worker loads the envelope from the outbox. It carries `organizationId` like all queue data (05). */
export interface EventJobData {
  readonly eventId: string;
  readonly handlerKey: string;
  readonly type: string;
  readonly organizationId: string | null;
}

/**
 * Adding a job twice with this ID is a no-op, which is what lets two dispatchers (or a retry after
 * a crash) enqueue the same pair safely. BullMQ rejects ":" and all-digit IDs, hence the "-".
 */
export function buildEventJobId(eventId: string, handlerKey: string): string {
  return `${eventId}-${handlerKey}`;
}

/** What the dispatcher needs from a queue. The BullMQ adapter is the only production implementation. */
export interface EventJobQueue {
  enqueue(job: EventJobData): Promise<void>;
}
