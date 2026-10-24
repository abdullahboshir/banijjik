/** Interprets a local wall time on a business date in `timeZone` as a UTC ISO string. */
export function localDateTimeToIso(
  businessDate: string,
  localTime: string,
  timeZone: string,
): string {
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
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(guess)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const asLocalMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second ?? "0"),
  );
  const wantedMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess.getTime() + (wantedMs - asLocalMs)).toISOString();
}

export function formatLocalTimeRange(input: {
  startsAt: string;
  endsAt: string;
  locale: string;
  timeZone: string;
}): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: input.timeZone,
  };
  const start = new Intl.DateTimeFormat(input.locale, options).format(new Date(input.startsAt));
  const end = new Intl.DateTimeFormat(input.locale, options).format(new Date(input.endsAt));
  return `${start} – ${end}`;
}

export function minutesToLocalTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** The `YYYY-MM-DDTHH:mm` text a datetime-local input shows for an instant, read in `timeZone`. */
export function isoToLocalInputValue(iso: string, timeZone: string): string {
  const parts: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const part of formatter.formatToParts(new Date(iso))) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Turns a datetime-local value, a wall time in `timeZone`, into a UTC ISO string; empty stays empty. */
export function localInputValueToIso(value: string, timeZone: string): string {
  const [date, time] = value.split("T");
  if (date === undefined || time === undefined || date === "" || time === "") return "";
  return localDateTimeToIso(date, time.slice(0, 5), timeZone);
}

/** The business date (YYYY-MM-DD) an instant falls on in `timeZone`. */
export function businessDateOfIso(iso: string, timeZone: string): string {
  return isoToLocalInputValue(iso, timeZone).slice(0, 10);
}

/** Moves a YYYY-MM-DD business date by whole calendar days (no clock involved, so no DST gap). */
export function addCalendarDays(businessDate: string, days: number): string {
  const [year, month, day] = businessDate.split("-").map(Number);
  const moved = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return moved.toISOString().slice(0, 10);
}
