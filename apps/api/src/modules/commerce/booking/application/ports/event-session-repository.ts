import type { EventSessionId } from "@banijjik/ids";
import type { EventSessionListQuery } from "@banijjik/validation/booking";
import type { EventSession } from "../../domain/event-session.entity.js";

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
}
