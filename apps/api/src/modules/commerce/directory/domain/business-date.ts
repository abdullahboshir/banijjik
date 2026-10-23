function partsInZone(instant: Date, timeZone: string): Record<string, string> {
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

/**
 * The UTC instant when the organization's local calendar day of `instant` began (M.7 decision 3).
 * One offset probe, like booking's local-time helper: the platform's timezones have no DST.
 */
export function businessDayStartUtc(instant: Date, timeZone: string): Date {
  const day = partsInZone(instant, timeZone);
  const wantedMs = Date.UTC(Number(day.year), Number(day.month) - 1, Number(day.day));
  const guess = new Date(wantedMs);
  const atGuess = partsInZone(guess, timeZone);
  const localMsAtGuess = Date.UTC(
    Number(atGuess.year),
    Number(atGuess.month) - 1,
    Number(atGuess.day),
    Number(atGuess.hour),
    Number(atGuess.minute),
    Number(atGuess.second),
  );
  return new Date(guess.getTime() + (wantedMs - localMsAtGuess));
}
