function partsInZone(instant: Date, timeZone: string): Readonly<Record<string, string>> {
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
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return parts;
}

/** The organization's business date as an ISO day, in its time zone, from the injected clock. */
export function businessDateOf(now: Date, timeZone: string): string {
  const parts = partsInZone(now, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The instant a local midnight falls on: a UTC guess corrected by the zone's offset at it. */
function localMidnightToUtc(businessDate: string, timeZone: string): Date {
  const guess = new Date(`${businessDate}T00:00:00.000Z`);
  const local = partsInZone(guess, timeZone);
  const localAsUtc = Date.UTC(
    Number(local.year),
    Number(local.month) - 1,
    Number(local.day),
    Number(local.hour),
    Number(local.minute),
    Number(local.second),
  );
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()));
}

/**
 * The instants that bound one business day of the organization: `from` inclusive, `to`
 * exclusive. A per-day limit counts with these, never with the UTC day of the date string
 * (between 00:00 and 06:00 Dhaka time the two days differ, §11 item 13).
 */
export function businessDayBounds(
  businessDate: string,
  timeZone: string,
): { readonly from: Date; readonly to: Date } {
  const from = localMidnightToUtc(businessDate, timeZone);
  const nextDay = new Date(`${businessDate}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const to = localMidnightToUtc(nextDay.toISOString().slice(0, 10), timeZone);
  return { from, to };
}
