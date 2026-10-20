import type { Weekday } from "@banijjik/contracts/booking";

const WEEKDAY_SHORT_TO_ISO: Readonly<Record<string, Weekday>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function partsInZone(instant: Date, timeZone: string): Readonly<Record<string, string>> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** Business calendar date `YYYY-MM-DD` in the organization timezone. */
export function businessDateOf(instant: Date, timeZone: string): string {
  const parts = partsInZone(instant, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function weekdayOf(instant: Date, timeZone: string): Weekday {
  const short = partsInZone(instant, timeZone).weekday ?? "Mon";
  const weekday = WEEKDAY_SHORT_TO_ISO[short];
  if (weekday === undefined) throw new Error(`unexpected weekday ${short}`);
  return weekday;
}

export function localTimeOf(instant: Date, timeZone: string): string {
  const parts = partsInZone(instant, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Interprets a local wall time on a business date in `timeZone` as a UTC `Date`.
 * Uses a single offset probe (sufficient for slot generation within one day).
 */
export function localDateTimeToUtc(
  businessDate: string,
  localTime: string,
  timeZone: string,
): Date {
  const [year, month, day] = businessDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new Error("invalid local date/time");
  }
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const asLocal = partsInZone(guess, timeZone);
  const asLocalMs = Date.UTC(
    Number(asLocal.year),
    Number(asLocal.month) - 1,
    Number(asLocal.day),
    Number(asLocal.hour),
    Number(asLocal.minute),
    Number(asLocal.second ?? "0"),
  );
  const wantedMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess.getTime() + (wantedMs - asLocalMs));
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}
