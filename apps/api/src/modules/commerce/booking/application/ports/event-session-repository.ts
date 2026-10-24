import type { EventSessionId } from "@banijjik/ids";
import type { EventSessionListQuery } from "@banijjik/validation/booking";
import type { EventSession } from "../../domain/event-session.entity.js";

export interface EventSessionSeatChange {
  readonly eventSessionId: EventSessionId;
  readonly seats: number;
}

export interface EventSessionRepository {
  insert(session: EventSession): Promise<void>;
  findById(eventSessionId: EventSessionId): Promise<EventSession | undefined>;
  update(
    session: EventSession,
    expectedVersion: number,
    previous: EventSession,
  ): Promise<EventSession>;
  list(
    query: EventSessionListQuery,
    allowedLocationIds: readonly string[] | "ALL",
  ): Promise<{ items: EventSession[]; hasNext: boolean }>;
  /** Take seats in one atomic write. False means the session is closed or full. */
  reserveSeats(change: EventSessionSeatChange): Promise<boolean>;
  /** Give seats back. Throws when the counter cannot cover it, because that is data drift. */
  releaseSeats(change: EventSessionSeatChange): Promise<void>;
  /** Cancelled sessions whose bookings have not been settled yet, oldest session first. */
  /** Pages in `eventSessionId` order (the index order); the cursor is the last id of the previous page. */
  listUnsettledCancellations(input: {
    readonly afterEventSessionId: EventSessionId | null;
    readonly limit: number;
  }): Promise<readonly EventSession[]>;
  /** Mark a cancelled session settled without touching its version. */
  markBookingsSettled(input: {
    readonly eventSessionId: EventSessionId;
    readonly now: Date;
  }): Promise<void>;
  /** Scheduled sessions whose end time has passed, ready to complete. */
  listEndedSessions(input: {
    readonly now: Date;
    readonly limit: number;
  }): Promise<readonly EventSession[]>;
}
