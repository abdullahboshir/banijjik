/** The organization's local calendar date `YYYY-MM-DD`, never the UTC date (02:00 in Dhaka is still the previous UTC day). */
export function businessDateOf(instant: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}
