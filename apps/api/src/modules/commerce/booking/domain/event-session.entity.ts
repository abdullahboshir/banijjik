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
export class EventSession {
  private constructor(private readonly props: EventSessionProps) {}

  static create(
    input: Omit<
      EventSessionProps,
      | "eventSessionId"
      | "status"
      | "seatsSold"
      | "bookingsSettledAt"
      | "version"
      | "createdAt"
      | "updatedAt"
      | "createdByUserId"
      | "updatedByUserId"
    > & { now: Date; actorUserId: UserId | null },
  ): EventSession {
    checkDates(input.startsAt, input.endsAt);
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
    now: Date;
    actorUserId: UserId | null;
  }): EventSession {
    this.assertScheduled();
    const startsAt = input.startsAt ?? this.props.startsAt;
    const endsAt = input.endsAt ?? this.props.endsAt;
    checkDates(startsAt, endsAt);
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
