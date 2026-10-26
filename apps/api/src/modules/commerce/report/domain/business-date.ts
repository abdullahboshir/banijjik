const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * The organization-local calendar day of an instant, `YYYY-MM-DD`. A fact at 00:30 in Dhaka counts
 * on that Dhaka date even though it is still the previous day in UTC (plan 3.10 decision 4).
 */
export function businessDateOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Moves a `YYYY-MM-DD` day by whole days. Calendar arithmetic in UTC: no time zone is involved. */
export function shiftBusinessDate(businessDate: string, days: number): string {
  const shifted = Date.parse(`${businessDate}T00:00:00Z`) + days * MILLISECONDS_PER_DAY;
  return new Date(shifted).toISOString().slice(0, "YYYY-MM-DD".length);
}

/** The first day of the month that holds `businessDate`. */
export function monthStartOf(businessDate: string): string {
  return `${businessDate.slice(0, "YYYY-MM".length)}-01`;
}

/** Every day from `from` to `to`, both included, oldest first. */
export function businessDatesBetween(from: string, to: string): readonly string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftBusinessDate(day, 1)) days.push(day);
  return days;
}
