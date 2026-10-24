import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  EVENT_SESSION_RULE_KEY,
  EVENT_SESSION_STATUS,
  type EventSessionStatus,
} from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import { MAX_RENTAL_DAYS } from "./rental-time.js";
export interface EventSessionResourceHold {
  readonly resourceId: ResourceId;
  readonly units: number;
}
export const MAX_EVENT_SESSION_RESOURCE_DAYS = MAX_RENTAL_DAYS;

export interface EventSessionProps {
  readonly eventSessionId: EventSessionId;
  readonly organizationId: OrganizationId;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly locationId: LocationId;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly capacity: number;
  readonly seatsSold: number;
  readonly resourceIds: readonly ResourceId[];
  readonly resourceHolds: readonly EventSessionResourceHold[];
  readonly status: EventSessionStatus;
  /** When a cancel pass has settled every booking of the session; null until then. */
  readonly bookingsSettledAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}
function refuse(ruleKey: string): never {
  throw new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, details: { ruleKey } });
}
function checkDates(startsAt: Date, endsAt: Date): void {
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    refuse(EVENT_SESSION_RULE_KEY.INVALID_DATES);
  }
}
function checkResourceSpan(resourceIds: readonly ResourceId[], startsAt: Date, endsAt: Date) {
  if (
    resourceIds.length > 0 &&
    endsAt.getTime() - startsAt.getTime() > MAX_EVENT_SESSION_RESOURCE_DAYS * 86400000
  )
    refuse(EVENT_SESSION_RULE_KEY.RESOURCE_SPAN_TOO_LONG);
}
/** Holds are a programming input: a mismatch with the resource ids is never a user error. */
function checkResourceHolds(
  resourceIds: readonly ResourceId[],
  holds: readonly EventSessionResourceHold[],
): void {
  if (
    holds.length !== resourceIds.length ||
    holds.some((hold) => !resourceIds.includes(hold.resourceId) || hold.units < 1) ||
    new Set(holds.map((hold) => hold.resourceId)).size !== holds.length
  )
    throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
}
export class EventSession {
  private constructor(private readonly props: EventSessionProps) {}

  static create(
    input: Pick<
      EventSessionProps,
      | "organizationId"
      | "offeringId"
      | "variantId"
      | "locationId"
      | "startsAt"
      | "endsAt"
      | "capacity"
      | "resourceIds"
    > & {
      now: Date;
      actorUserId: UserId | null;
      resourceHolds?: readonly EventSessionResourceHold[];
    },
  ): EventSession {
    checkDates(input.startsAt, input.endsAt);
    const resourceHolds = input.resourceHolds ?? [];
    checkResourceSpan(input.resourceIds, input.startsAt, input.endsAt);
    checkResourceHolds(input.resourceIds, resourceHolds);
    return new EventSession({
      eventSessionId: asId<EventSessionId>(newId()),
      organizationId: input.organizationId,
      offeringId: input.offeringId,
      variantId: input.variantId,
      locationId: input.locationId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      resourceIds: input.resourceIds,
      resourceHolds,
      seatsSold: 0,
      bookingsSettledAt: null,
      version: 1,
      status: EVENT_SESSION_STATUS.SCHEDULED,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }
  static rehydrate(props: EventSessionProps): EventSession {
    return new EventSession(props);
  }
  toProps(): EventSessionProps {
    return this.props;
  }

  update(input: {
    startsAt?: Date;
    endsAt?: Date;
    capacity?: number;
    resourceHolds?: readonly EventSessionResourceHold[];
    now: Date;
    actorUserId: UserId | null;
  }): EventSession {
    this.assertScheduled();
    const startsAt = input.startsAt ?? this.props.startsAt;
    const endsAt = input.endsAt ?? this.props.endsAt;
    checkDates(startsAt, endsAt);
    checkResourceSpan(this.props.resourceIds, startsAt, endsAt);
    // A session made before holds existed keeps its empty holds until its time changes.
    if (input.resourceHolds !== undefined)
      checkResourceHolds(this.props.resourceIds, input.resourceHolds);
    const resourceHolds = input.resourceHolds ?? this.props.resourceHolds;
    const timeChanged =
      startsAt.getTime() !== this.props.startsAt.getTime() ||
      endsAt.getTime() !== this.props.endsAt.getTime();
    if (timeChanged && this.props.seatsSold > 0) refuse(EVENT_SESSION_RULE_KEY.TIME_LOCKED);
    const capacity = input.capacity ?? this.props.capacity;
    if (capacity < this.props.seatsSold) refuse(EVENT_SESSION_RULE_KEY.CAPACITY_BELOW_SOLD);
    return new EventSession({
      ...this.props,
      startsAt,
      endsAt,
      capacity,
      resourceHolds,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }
  cancel(now: Date, actorUserId: UserId | null): EventSession {
    this.assertScheduled();
    return new EventSession({
      ...this.props,
      status: EVENT_SESSION_STATUS.CANCELLED,
      updatedAt: now,
      updatedByUserId: actorUserId,
      resourceHolds: [],
    });
  }
  /** A past session leaves SCHEDULED so availability and the cancel job stop looking at it. */
  complete(now: Date, actorUserId: UserId | null): EventSession {
    this.assertScheduled();
    return new EventSession({
      ...this.props,
      status: EVENT_SESSION_STATUS.COMPLETED,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
  private assertScheduled(): void {
    if (this.props.status !== EVENT_SESSION_STATUS.SCHEDULED) {
      throw new DomainRuleError({ code: ERROR_CODE.INVALID_TRANSITION });
    }
  }
}
