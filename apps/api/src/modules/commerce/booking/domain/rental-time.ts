import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type { RentalDetails } from "@banijjik/contracts/catalog";
import { bookingRuleError } from "./errors.js";
import { businessDateOf, localDateTimeToUtc, localTimeOf } from "./timezone.js";

export const MAX_RENTAL_DAYS = 31;
export const MAX_RENTAL_HOURS = MAX_RENTAL_DAYS * 24;
export const DEFAULT_CHECK_IN_TIME = "14:00";
export const DEFAULT_CHECK_OUT_TIME = "11:00";

const ONE_HOUR_MS = 60 * 60 * 1000;
// Allow +1 hour margin for DST fall-back day (25 hours) when checking duration in ms
const MAX_RENTAL_DURATION_MS = MAX_RENTAL_DAYS * 24 * ONE_HOUR_MS + ONE_HOUR_MS;

export function addCalendarDays(businessDate: string, days: number): string {
  const [year, month, day] = businessDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid businessDate: ${businessDate}`);
  }
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RentalTimeResult {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
  readonly quantity: number;
}

function resolveRentalQuantity(rental: RentalDetails, requestedQuantity?: number): number {
  const minUnits = rental.minUnits ?? 1;
  const quantity = requestedQuantity ?? minUnits;
  if (quantity < minUnits || (rental.maxUnits !== undefined && quantity > rental.maxUnits)) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_RENTAL_UNITS_OUT_OF_RANGE);
  }
  return quantity;
}

function computeHourRental(startsAt: Date, quantity: number): { startsAt: Date; endsAt: Date } {
  if (quantity > MAX_RENTAL_HOURS) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_RENTAL_DURATION_EXCEEDED);
  }
  return { startsAt, endsAt: new Date(startsAt.getTime() + quantity * ONE_HOUR_MS) };
}

function computeDayRental(
  startsAt: Date,
  quantity: number,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  if (quantity > MAX_RENTAL_DAYS) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_RENTAL_DURATION_EXCEEDED);
  }
  const localDate = businessDateOf(startsAt, timeZone);
  const localTime = localTimeOf(startsAt, timeZone);
  const endDate = addCalendarDays(localDate, quantity);
  return { startsAt, endsAt: localDateTimeToUtc(endDate, localTime, timeZone) };
}

function computeNightRental(input: {
  readonly startsAt: Date;
  readonly quantity: number;
  readonly rental: RentalDetails;
  readonly timeZone: string;
}): { startsAt: Date; endsAt: Date } {
  if (input.quantity > MAX_RENTAL_DAYS) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_RENTAL_DURATION_EXCEEDED);
  }
  const checkInDay = businessDateOf(input.startsAt, input.timeZone);
  const checkInTime = input.rental.checkInTime ?? DEFAULT_CHECK_IN_TIME;
  const actualStartsAt = localDateTimeToUtc(checkInDay, checkInTime, input.timeZone);

  const checkOutDay = addCalendarDays(checkInDay, input.quantity);
  const checkOutTime = input.rental.checkOutTime ?? DEFAULT_CHECK_OUT_TIME;
  const endsAt = localDateTimeToUtc(checkOutDay, checkOutTime, input.timeZone);
  return { startsAt: actualStartsAt, endsAt };
}

export function computeRentalTime(input: {
  readonly startsAt: Date;
  readonly quantity?: number | undefined;
  readonly rental: RentalDetails;
  readonly timeZone: string;
}): RentalTimeResult {
  const quantity = resolveRentalQuantity(input.rental, input.quantity);

  const interval = (() => {
    switch (input.rental.rateUnit) {
      case "HOUR":
        return computeHourRental(input.startsAt, quantity);
      case "DAY":
        return computeDayRental(input.startsAt, quantity, input.timeZone);
      case "NIGHT":
        return computeNightRental({
          startsAt: input.startsAt,
          quantity,
          rental: input.rental,
          timeZone: input.timeZone,
        });
      default: {
        const never: never = input.rental.rateUnit;
        throw new Error(`unknown rateUnit: ${String(never)}`);
      }
    }
  })();

  const durationMs = interval.endsAt.getTime() - interval.startsAt.getTime();
  if (durationMs <= 0 || durationMs > MAX_RENTAL_DURATION_MS) {
    throw bookingRuleError(BOOKING_RULE_KEY.BOOKING_RENTAL_DURATION_EXCEEDED);
  }

  return {
    startsAt: interval.startsAt,
    endsAt: interval.endsAt,
    blockedEndsAt: interval.endsAt,
    quantity,
  };
}
