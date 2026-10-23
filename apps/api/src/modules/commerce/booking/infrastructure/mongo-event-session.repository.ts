import { asId, type LocationId, type OfferingId, type EventSessionId } from "@banijjik/ids";
import type { EventSessionListQuery } from "@banijjik/validation/booking";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { EventSessionRepository } from "../application/ports/event-session-repository.js";
import { EventSession, type EventSessionProps } from "../domain/event-session.entity.js";
import { EVENT_SESSION_MODEL_NAME } from "./event-session.schema.js";

function sessionModel(): Model<EventSessionProps> {
  return models({}).get<EventSessionProps>(EVENT_SESSION_MODEL_NAME);
}
export class MongoEventSessionRepository implements EventSessionRepository {
  async insert(session: EventSession): Promise<void> {
    await sessionModel().create([session.toProps()], sessionOption(getActiveSession()));
  }
  async findById(eventSessionId: EventSessionId): Promise<EventSession | undefined> {
    const row = await sessionModel()
      .findOne({ eventSessionId })
      .select("-_id -__v")
      .lean<EventSessionProps>();
    return row === null ? undefined : EventSession.rehydrate(row);
  }
  async list(query: EventSessionListQuery): Promise<{ items: EventSession[]; hasNext: boolean }> {
    const filter: QueryFilter<EventSessionProps> = {};
    if (query.locationId !== undefined) filter.locationId = asId<LocationId>(query.locationId);
    if (query.offeringId !== undefined) filter.offeringId = asId<OfferingId>(query.offeringId);
    if (query.status !== undefined) filter.status = query.status;
    const rows = await sessionModel()
      .find(filter)
      .select("-_id -__v")
      .sort({ startsAt: 1, eventSessionId: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<EventSessionProps[]>();
    return {
      items: rows.slice(0, query.limit).map(EventSession.rehydrate),
      hasNext: rows.length > query.limit,
    };
  }
  async update(session: EventSession, expectedVersion: number): Promise<EventSession> {
    const props = session.toProps();
    const updated = await updateVersioned({
      model: sessionModel(),
      filter: { eventSessionId: props.eventSessionId },
      expectedVersion,
      update: {
        $set: {
          startsAt: props.startsAt,
          endsAt: props.endsAt,
          capacity: props.capacity,
          status: props.status,
          updatedAt: props.updatedAt,
          updatedByUserId: props.updatedByUserId,
        },
      },
    });
    return EventSession.rehydrate(updated);
  }
}
