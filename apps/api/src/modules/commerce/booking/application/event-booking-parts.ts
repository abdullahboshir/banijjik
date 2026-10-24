import { DomainRuleError, ERROR_CODE, OFFERING_KIND } from "@banijjik/contracts";
import { BOOKING_KIND, BOOKING_RULE_KEY, EVENT_SESSION_STATUS } from "@banijjik/contracts/booking";
import {
  asId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type ResourceId,
} from "@banijjik/ids";
import { bookingRuleError, eventSoldOutError } from "../domain/errors.js";
import type { Booking } from "../domain/booking.entity.js";
import type { EventSessionProps } from "../domain/event-session.entity.js";
import type { EventSessionRepository } from "./ports/event-session-repository.js";
import type { EventOfferingView, OfferingBookingView } from "./ports/booking-context-ports.js";
import type { ResourceSlotUsagePort } from "./ports/booking-repositories.js";

/** What a booked seat sits on: the session's times, its resources and how many seats. */
export interface EventBookingTarget {
  readonly eventSessionId: EventSessionId;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
  readonly resourceIds: readonly ResourceId[];
  readonly seats: number;
}

/** A booking is one seat unless the buyer asks for more. */
export function eventSeatCount(requestedQuantity: number | undefined): number {
  return requestedQuantity ?? 1;
}

/** An EVENT booking must name the session whose seats it buys. */
export function requireEventSessionId(eventSessionId: string | undefined): EventSessionId {
  if (eventSessionId === undefined) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SESSION_REQUIRED);
  }
  return asId<EventSessionId>(eventSessionId);
}

/** Only an EVENT booking may name a session; any other kind is a client mistake. */
export function rejectEventSessionOn(eventSessionId: string | undefined): void {
  if (eventSessionId === undefined) return;
  throw new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { ruleKey: BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE },
  });
}

function belongsToOffering(
  props: EventSessionProps,
  input: {
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly locationId: LocationId;
  },
): boolean {
  return (
    props.offeringId === input.offeringId &&
    props.variantId === input.variantId &&
    props.locationId === input.locationId
  );
}

function assertSalesStillOpen(
  props: EventSessionProps,
  salesCloseMinutesBefore: number,
  now: Date,
): void {
  const closesAt = new Date(props.startsAt.getTime() - salesCloseMinutesBefore * 60_000);
  if (now.getTime() > closesAt.getTime()) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SALES_CLOSED);
  }
}

/** The session must exist, sell this offering here, still be scheduled and still be on sale. */
export async function resolveEventBookingTarget(input: {
  readonly sessions: EventSessionRepository;
  readonly offering: EventOfferingView;
  readonly eventSessionId: EventSessionId;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly locationId: LocationId;
  readonly seats: number;
  readonly now: Date;
}): Promise<EventBookingTarget> {
  const session = await input.sessions.findById(input.eventSessionId);
  if (session === undefined || !belongsToOffering(session.toProps(), input)) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SESSION_NOT_OPEN);
  }
  const props = session.toProps();
  if (props.status !== EVENT_SESSION_STATUS.SCHEDULED) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SESSION_NOT_OPEN);
  }
  assertSalesStillOpen(props, input.offering.event.salesCloseMinutesBefore, input.now);
  return {
    eventSessionId: props.eventSessionId,
    startsAt: props.startsAt,
    endsAt: props.endsAt,
    blockedEndsAt: props.endsAt,
    resourceIds: props.resourceIds,
    seats: input.seats,
  };
}

/** The EVENT arm of the bounds decision: the session owns the times, the buyer owns the seats. */
export interface EventBookingBounds {
  readonly kind: typeof BOOKING_KIND.EVENT;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
  readonly quantity: number;
}

export function eventBookingBounds(target: EventBookingTarget): EventBookingBounds {
  return {
    kind: BOOKING_KIND.EVENT,
    startsAt: target.startsAt,
    endsAt: target.endsAt,
    blockedEndsAt: target.blockedEndsAt,
    quantity: target.seats,
  };
}

/** An event booking moves between sessions of the same offering, never to a new start time. */
export async function resolveEventRescheduleTarget(input: {
  readonly sessions: EventSessionRepository;
  readonly offering: OfferingBookingView;
  readonly booking: Booking;
  readonly eventSessionId: string | undefined;
  readonly now: Date;
}): Promise<EventBookingTarget> {
  if (input.offering.kind !== OFFERING_KIND.EVENT) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  const target = await resolveEventBookingTarget({
    sessions: input.sessions,
    offering: input.offering,
    eventSessionId: requireEventSessionId(input.eventSessionId),
    offeringId: input.booking.offeringId,
    variantId: input.booking.variantId,
    locationId: input.booking.locationId,
    seats: input.booking.quantity,
    now: input.now,
  });
  if (target.eventSessionId === input.booking.eventSessionId) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SAME_SESSION);
  }
  return target;
}

/** Seats are taken in one atomic write inside the booking transaction. */
export async function reserveEventSeats(input: {
  readonly sessions: EventSessionRepository;
  readonly eventSessionId: EventSessionId;
  readonly seats: number;
}): Promise<void> {
  const reserved = await input.sessions.reserveSeats({
    eventSessionId: input.eventSessionId,
    seats: input.seats,
  });
  if (reserved) return;
  const session = await input.sessions.findById(input.eventSessionId);
  if (session === undefined || session.toProps().status !== EVENT_SESSION_STATUS.SCHEDULED) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_EVENT_SESSION_NOT_OPEN);
  }
  throw eventSoldOutError();
}

/** A slot booking blocks one resource; an event booking blocks none, so there is nothing to free. */
async function releaseSlotCapacity(booking: Booking, slots: ResourceSlotUsagePort): Promise<void> {
  const resourceId = booking.resourceIds[0];
  if (resourceId === undefined) return;
  await slots.releaseCapacity({
    organizationId: booking.organizationId,
    resourceId,
    startsAt: booking.startsAt,
    blockedEndsAt: booking.blockedEndsAt,
  });
}

/** A missed booking frees its resource, but an event keeps its seat because the session is over. */
export async function releaseCapacityForMissedBooking(input: {
  readonly booking: Booking;
  readonly slots: ResourceSlotUsagePort;
}): Promise<void> {
  if (input.booking.kind === BOOKING_KIND.EVENT) return;
  await releaseSlotCapacity(input.booking, input.slots);
}

/** One release path: an event booking gives seats back, every other kind gives its slot back. */
export async function releaseBookingCapacity(input: {
  readonly booking: Booking;
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
}): Promise<void> {
  const booking = input.booking;
  if (booking.kind === BOOKING_KIND.EVENT) {
    if (booking.eventSessionId !== null) {
      await input.sessions.releaseSeats({
        eventSessionId: booking.eventSessionId,
        seats: booking.quantity,
      });
    }
    return;
  }
  await releaseSlotCapacity(booking, input.slots);
}
