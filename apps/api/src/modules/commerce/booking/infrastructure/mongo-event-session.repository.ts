import { asId, type LocationId, type OfferingId, type EventSessionId } from "@banijjik/ids";
import type { EventSessionListQuery } from "@banijjik/validation/booking";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { EVENT_SESSION_RULE_KEY, EVENT_SESSION_STATUS } from "@banijjik/contracts/booking";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { conflict } from "../../../../kernel/http/index.js";
import { recordNotFound } from "../domain/errors.js";
import type {
  EventSessionRepository,
  EventSessionSeatChange,
} from "../application/ports/event-session-repository.js";
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
  async list(
    query: EventSessionListQuery,
    allowedLocationIds: readonly string[] | "ALL",
  ): Promise<{ items: EventSession[]; hasNext: boolean }> {
    const filter: QueryFilter<EventSessionProps> = {};
    if (allowedLocationIds !== "ALL") {
      filter.locationId = { $in: allowedLocationIds.map((value) => asId<LocationId>(value)) };
    }
    if (query.locationId !== undefined) {
      filter.$and = [{ locationId: asId<LocationId>(query.locationId) }];
    }
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
  async update(
    session: EventSession,
    expectedVersion: number,
    previous: EventSession,
  ): Promise<EventSession> {
    const props = session.toProps();
    const before = previous.toProps();
    const timeChanged =
      props.startsAt.getTime() !== before.startsAt.getTime() ||
      props.endsAt.getTime() !== before.endsAt.getTime();
    // Seat reservations do not bump version; enforce these invariants in the atomic write too.
    const updated = await sessionModel()
      .findOneAndUpdate(
        {
          eventSessionId: props.eventSessionId,
          version: expectedVersion,
          seatsSold: timeChanged ? 0 : { $lte: props.capacity },
        },
        {
          $set: {
            startsAt: props.startsAt,
            endsAt: props.endsAt,
            capacity: props.capacity,
            resourceHolds: props.resourceHolds,
            status: props.status,
            updatedAt: props.updatedAt,
            updatedByUserId: props.updatedByUserId,
          },
          $inc: { version: 1 },
        },
        { returnDocument: "after", runValidators: true, ...sessionOption(getActiveSession()) },
      )
      .select("-_id -__v")
      .lean<EventSessionProps>();
    if (updated !== null) return EventSession.rehydrate(updated);
    return this.rejectUpdate(props, expectedVersion, timeChanged);
  }
  async reserveSeats(change: EventSessionSeatChange): Promise<boolean> {
    // The seat check and the counter move in one atomic write, so two sales cannot oversell.
    const updated = await sessionModel()
      .findOneAndUpdate(
        {
          eventSessionId: change.eventSessionId,
          status: EVENT_SESSION_STATUS.SCHEDULED,
          $expr: { $lte: [{ $add: ["$seatsSold", change.seats] }, "$capacity"] },
        },
        { $inc: { seatsSold: change.seats } },
        { ...sessionOption(getActiveSession()) },
      )
      .lean();
    return updated !== null;
  }

  async releaseSeats(change: EventSessionSeatChange): Promise<void> {
    const updated = await sessionModel()
      .findOneAndUpdate(
        {
          eventSessionId: change.eventSessionId,
          seatsSold: { $gte: change.seats },
        },
        { $inc: { seatsSold: -change.seats } },
        { ...sessionOption(getActiveSession()) },
      )
      .lean();
    if (updated === null) {
      throw new Error(
        `event session ${change.eventSessionId} cannot release ${change.seats} seats`,
      );
    }
  }

  async listUnsettledCancellations(input: {
    readonly afterEventSessionId: EventSessionId | null;
    readonly limit: number;
  }): Promise<readonly EventSession[]> {
    const filter: QueryFilter<EventSessionProps> = {
      status: EVENT_SESSION_STATUS.CANCELLED,
      bookingsSettledAt: null,
    };
    if (input.afterEventSessionId !== null) {
      filter.eventSessionId = { $gt: input.afterEventSessionId };
    }
    const rows = await sessionModel()
      .find(filter)
      .select("-_id -__v")
      .sort({ eventSessionId: 1 })
      .limit(input.limit)
      .lean<EventSessionProps[]>();
    return rows.map(EventSession.rehydrate);
  }

  async markBookingsSettled(input: {
    readonly eventSessionId: EventSessionId;
    readonly now: Date;
  }): Promise<void> {
    // The settlement marker is job bookkeeping, so it must not bump the version admins see.
    await sessionModel()
      .findOneAndUpdate(
        { eventSessionId: input.eventSessionId, bookingsSettledAt: null },
        { $set: { bookingsSettledAt: input.now, updatedAt: input.now } },
        sessionOption(getActiveSession()),
      )
      .lean();
  }

  async listEndedSessions(input: {
    readonly now: Date;
    readonly limit: number;
  }): Promise<readonly EventSession[]> {
    const filter: QueryFilter<EventSessionProps> = {
      status: EVENT_SESSION_STATUS.SCHEDULED,
      endsAt: { $lte: input.now },
    };
    const rows = await sessionModel()
      .find(filter)
      .select("-_id -__v")
      .sort({ endsAt: 1, eventSessionId: 1 })
      .limit(input.limit)
      .lean<EventSessionProps[]>();
    return rows.map(EventSession.rehydrate);
  }

  private async rejectUpdate(
    props: EventSessionProps,
    expectedVersion: number,
    timeChanged: boolean,
  ): Promise<never> {
    const current = await this.findById(props.eventSessionId);
    if (current === undefined) throw recordNotFound();
    const stored = current.toProps();
    if (stored.version !== expectedVersion) throw conflict({ currentVersion: stored.version });
    const ruleKey =
      timeChanged && stored.seatsSold > 0
        ? EVENT_SESSION_RULE_KEY.TIME_LOCKED
        : EVENT_SESSION_RULE_KEY.CAPACITY_BELOW_SOLD;
    throw new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, details: { ruleKey } });
  }
}
