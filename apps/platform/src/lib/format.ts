import { formatNumber } from "@banijjik/ui";
import type { Locale } from "@banijjik/i18n";

/** A whole number in the digits of the active language (Bangla digits for bn, ADR-055). */
export function formatCount(value: number, locale: Locale): string {
  return formatNumber(value, {
    locale,
    digitScript: locale === "bn" ? "BENGALI" : "LATIN",
  });
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
};
const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Dhaka",
};
const LOCALE_TAGS: Record<Locale, string> = { bn: "bn-BD", en: "en-GB" };

/** Date and time of an instant in Bangladesh time. Instants come from the API as ISO strings. */
export function formatDateTime(isoInstant: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], DATE_TIME_OPTIONS).format(
    new Date(isoInstant),
  );
}

export function formatDate(isoInstant: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], DATE_OPTIONS).format(new Date(isoInstant));
}

const SHORT_ID_LENGTH = 8;

/** The last characters of an id (the first characters of a UUID v7 are the timestamp and look alike). */
export function shortId(id: string): string {
  return id.slice(-SHORT_ID_LENGTH);
}
