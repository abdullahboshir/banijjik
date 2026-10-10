export const SUPPORTED_LOCALES = ["bn", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Bangla is the default UI language (ADR-055). */
export const DEFAULT_LOCALE: Locale = "bn";

export function isSupportedLocale(value: string): value is Locale {
  // Safe: widening the tuple to string[] only lets `includes` accept an arbitrary string; nothing is written.
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
