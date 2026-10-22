import {
  BOOKING_STATUS,
  MAX_HISTORY_ENTRIES,
  type BookingHistoryEntry,
  type BookingStatus,
  type Money,
} from "@banijjik/contracts/booking";
import type { MemberId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingProps } from "./booking.entity.js";
import type { BookingTransitionAction } from "./transitions.js";
import { assertTransitionAllowed, targetStatusFor } from "./transitions.js";

export type { BookingHistoryEntry };

export function nextStatusAfterTransition(input: {
  action: BookingTransitionAction;
  bookingNumber?: string | null;
}): BookingStatus {
  if (
    input.action === "request" &&
    input.bookingNumber !== undefined &&
    input.bookingNumber !== null
  ) {
    return BOOKING_STATUS.CONFIRMED;
  }
  if (input.action === "confirm") return BOOKING_STATUS.CONFIRMED;
  return targetStatusFor(input.action);
}

export function rescheduleHistoryEntry(input: {
  action: BookingTransitionAction;
  now: Date;
  actorUserId: UserId | null;
  note?: string;
  fromStartsAt: Date;
  fromEndsAt: Date;
  toStartsAt: Date;
  toEndsAt: Date;
}): BookingHistoryEntry | undefined {
  if (input.action !== "reschedule") return undefined;
  return {
    at: input.now.toISOString(),
    action: "reschedule",
    fromStartsAt: input.fromStartsAt.toISOString(),
    fromEndsAt: input.fromEndsAt.toISOString(),
    toStartsAt: input.toStartsAt.toISOString(),
    toEndsAt: input.toEndsAt.toISOString(),
    ...(input.actorUserId === null ? {} : { actorUserId: input.actorUserId as string }),
    ...(input.note === undefined ? {} : { note: input.note }),
  };
}

export function appendHistory(
  history: readonly BookingHistoryEntry[],
  entry: BookingHistoryEntry | undefined,
): readonly BookingHistoryEntry[] {
  if (entry === undefined) return history;
  return [...history, entry].slice(-MAX_HISTORY_ENTRIES);
}

function statusAfterTransition(
  action: BookingTransitionAction,
  bookingNumber: string | null | undefined,
): BookingStatus {
  return nextStatusAfterTransition({
    action,
    ...(bookingNumber === undefined ? {} : { bookingNumber }),
  });
}

function propsAfterReschedule(
  props: BookingProps,
  reschedule: {
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly blockedEndsAt: Date;
    readonly resourceIds: readonly ResourceId[];
    readonly providerMemberId: MemberId | null;
  },
): Pick<
  BookingProps,
  "startsAt" | "endsAt" | "blockedEndsAt" | "resourceIds" | "providerMemberId"
> {
  return {
    startsAt: reschedule.startsAt,
    endsAt: reschedule.endsAt,
    blockedEndsAt: reschedule.blockedEndsAt,
    resourceIds: reschedule.resourceIds,
    providerMemberId: reschedule.providerMemberId,
  };
}

export function transitionBookingProps(
  props: BookingProps,
  action: BookingTransitionAction,
  input: {
    readonly now: Date;
    readonly actorUserId: UserId | null;
    readonly bookingNumber?: string | null;
    readonly note?: string;
    readonly cancellationFeeRetained?: Money | null;
    readonly reschedule?: {
      readonly startsAt: Date;
      readonly endsAt: Date;
      readonly blockedEndsAt: Date;
      readonly resourceIds: readonly ResourceId[];
      readonly providerMemberId: MemberId | null;
    };
  },
): BookingProps {
  assertTransitionAllowed(props.status, action);
  const status = statusAfterTransition(action, input.bookingNumber);
  const historyEntry =
    input.reschedule === undefined
      ? undefined
      : rescheduleHistoryEntry({
          action,
          now: input.now,
          actorUserId: input.actorUserId,
          ...(input.note === undefined ? {} : { note: input.note }),
          fromStartsAt: props.startsAt,
          fromEndsAt: props.endsAt,
          toStartsAt: input.reschedule.startsAt,
          toEndsAt: input.reschedule.endsAt,
        });
  const rescheduled =
    input.reschedule === undefined ? {} : propsAfterReschedule(props, input.reschedule);
  return {
    ...props,
    ...rescheduled,
    status,
    bookingNumber: input.bookingNumber === undefined ? props.bookingNumber : input.bookingNumber,
    ...(input.cancellationFeeRetained === undefined
      ? {}
      : { cancellationFeeRetained: input.cancellationFeeRetained }),
    history: appendHistory(props.history, historyEntry),
    updatedAt: input.now,
    updatedByUserId: input.actorUserId,
  };
}
