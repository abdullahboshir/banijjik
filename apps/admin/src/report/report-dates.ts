const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MILLISECONDS_PER_DAY = 86_400_000;

/** The days of the default reports range: the last 7 days, today included. */
export const DEFAULT_RANGE_DAYS = 7;

/** Today's date (`YYYY-MM-DD`) in the business time zone, the same day the API counts in. */
export function businessTodayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True for a `YYYY-MM-DD` text that names a real calendar day. */
export function isBusinessDate(value: string | undefined): value is string {
  if (value === undefined || !BUSINESS_DATE_PATTERN.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Moves a business date by whole days; calendar arithmetic, so month and leap-year ends are right. */
export function shiftBusinessDate(date: string, days: number): string {
  const shifted = Date.parse(`${date}T00:00:00Z`) + days * MILLISECONDS_PER_DAY;
  return new Date(shifted).toISOString().slice(0, 10);
}

/** The number of days of an inclusive range; a reversed range has no days. */
export function inclusiveDayCount(from: string, to: string): number {
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MILLISECONDS_PER_DAY;
  return days < 0 ? 0 : days + 1;
}
