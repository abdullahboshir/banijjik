import type { RentalDetails } from "@banijjik/contracts/catalog";
import {
  addCalendarDays,
  businessDateOfIso,
  isoToLocalInputValue,
  localDateTimeToIso,
} from "./booking-local-time";

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_CHECK_IN_TIME = "14:00";
const DEFAULT_CHECK_OUT_TIME = "11:00";

/**
 * Shows the person where a rental will end before they confirm. The API stays the authority:
 * it recomputes the same interval (11 section 2) and refuses a stay it does not accept.
 */
export function rentalEndPreview(input: {
  startsAt: string;
  quantity: number;
  rental: Pick<RentalDetails, "rateUnit" | "checkInTime" | "checkOutTime">;
  timeZone: string;
}): { startsAt: string; endsAt: string } | null {
  if (input.startsAt === "" || !Number.isInteger(input.quantity) || input.quantity < 1) return null;
  const { rental, timeZone } = input;
  const day = businessDateOfIso(input.startsAt, timeZone);
  if (rental.rateUnit === "HOUR") {
    const endsAt = new Date(Date.parse(input.startsAt) + input.quantity * ONE_HOUR_MS);
    return { startsAt: input.startsAt, endsAt: endsAt.toISOString() };
  }
  if (rental.rateUnit === "DAY") {
    const time = isoToLocalInputValue(input.startsAt, timeZone).slice(11);
    const endsAt = localDateTimeToIso(addCalendarDays(day, input.quantity), time, timeZone);
    return { startsAt: input.startsAt, endsAt };
  }
  return {
    startsAt: localDateTimeToIso(day, rental.checkInTime ?? DEFAULT_CHECK_IN_TIME, timeZone),
    endsAt: localDateTimeToIso(
      addCalendarDays(day, input.quantity),
      rental.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
      timeZone,
    ),
  };
}
