import type { EventSessionId } from "@banijjik/ids";
import type { EventSessionListQuery } from "@banijjik/validation/booking";
import type { EventSession } from "../../domain/event-session.entity.js";

export interface EventSessionRepository {
  insert(session: EventSession): Promise<void>;
  findById(eventSessionId: EventSessionId): Promise<EventSession | undefined>;
  update(session: EventSession, expectedVersion: number): Promise<EventSession>;
  list(query: EventSessionListQuery): Promise<{ items: EventSession[]; hasNext: boolean }>;
}
