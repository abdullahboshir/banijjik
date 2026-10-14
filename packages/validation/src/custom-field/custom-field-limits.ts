/** Default and hard limits of custom field values (card 2.3). Each one is named so a caller cannot hide a magic number. */
export const CUSTOM_FIELD_TEXT_MAX_LENGTH = 200;
export const CUSTOM_FIELD_LONG_TEXT_MAX_LENGTH = 2000;
export const CUSTOM_FIELD_MULTI_SELECT_MAX = 20;
export const CUSTOM_FIELD_URL_MAX_LENGTH = 2048;
export const CUSTOM_FIELD_SAFE_INTEGER_MIN = Number.MIN_SAFE_INTEGER;
export const CUSTOM_FIELD_SAFE_INTEGER_MAX = Number.MAX_SAFE_INTEGER;

/** Canonical decimal text. A float is refused because money and quantities must not use binary floats (ADR-102). */
export const CUSTOM_FIELD_DECIMAL_PATTERN = /^-?\d{1,12}(\.\d{1,4})?$/;

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const HOUR_MAX = 23;
const MINUTE_MAX = 59;

function calendarParts(match: RegExpExecArray): { year: number; month: number; day: number } {
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** True only for a real calendar day. `2026-02-30` is refused; JavaScript would otherwise roll it into March. */
export function isRealCalendarDay(value: string): boolean {
  const match = CALENDAR_DAY.exec(value);
  if (match === null) return false;
  const { year, month, day } = calendarParts(match);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** ISO-8601 with an offset (`Z` or `±hh:mm`). A value without an offset is refused so the zone is never guessed. */
export function isRealDateTime(value: string): boolean {
  const match = INSTANT_WITH_OFFSET.exec(value);
  if (match === null) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > HOUR_MAX || minute > MINUTE_MAX || second > MINUTE_MAX) return false;
  return isRealCalendarDay(`${match[1]}-${match[2]}-${match[3]}`);
}
