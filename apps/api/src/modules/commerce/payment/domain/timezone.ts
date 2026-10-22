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
