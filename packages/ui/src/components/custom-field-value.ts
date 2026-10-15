const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/;
const INTEGER_TEXT = /^-?\d+$/u;
const MINUTES_PER_HOUR = 60;

/** An emptied box becomes null. Anything else is the text the schema will accept or refuse. */
export function textOrNull(text: string): string | null {
  if (text === "") return null;
  return text;
}

/** Integer text only. A decimal or other token is kept as text so the shared schema can refuse it. */
export function parseIntegerInput(text: string): number | string | null {
  if (text === "") return null;
  if (!INTEGER_TEXT.test(text)) return text;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return text;
  return value;
}

function pad(part: number): string {
  return String(part).padStart(2, "0");
}

function offsetOf(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(totalMinutes);
  const hours = pad(Math.floor(absolute / MINUTES_PER_HOUR));
  const minutes = pad(absolute % MINUTES_PER_HOUR);
  return `${sign}${hours}:${minutes}`;
}

function formatLocalDateTime(date: Date): string {
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${date.getFullYear()}-${month}-${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` has no offset. The stored value always carries the browser's offset. */
export function toIsoWithBrowserOffset(localValue: string): string {
  const match = LOCAL_DATE_TIME.exec(localValue);
  if (match === null) return localValue;
  const seconds = match[2] ?? "00";
  const date = new Date(`${match[1]}:${seconds}`);
  if (Number.isNaN(date.getTime())) return localValue;
  return `${match[1]}:${seconds}${offsetOf(date)}`;
}

/** Shows a stored ISO instant in the local `datetime-local` shape. */
export function toDateTimeLocalValue(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  if (LOCAL_DATE_TIME.test(value) && value.length === 16) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatLocalDateTime(date);
}
