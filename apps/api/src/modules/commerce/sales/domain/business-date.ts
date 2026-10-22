interface DateParts {
  readonly year: string;
  readonly month: string;
  readonly day: string;
}

function partsOf(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: valueOf("year"), month: valueOf("month"), day: valueOf("day") };
}

/** The organization-local calendar day of an instant, `YYYY-MM-DD` (09 §5.5 `businessDate`). */
export function businessDateOf(date: Date, timeZone: string): string {
  const { year, month, day } = partsOf(date, timeZone);
  return `${year}-${month}-${day}`;
}

/** The organization-local calendar month, for the monthly order counter (decision 7). */
export function businessMonthKeyOf(date: Date, timeZone: string): string {
  const { year, month } = partsOf(date, timeZone);
  return `${year}-${month}`;
}
