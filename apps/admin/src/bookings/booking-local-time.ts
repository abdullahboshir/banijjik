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
