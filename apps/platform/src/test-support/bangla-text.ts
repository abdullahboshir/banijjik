import { BUNDLED_CATALOGS, PLATFORM_SCREEN_CATALOGS } from "@banijjik/i18n";

/** Bangla catalog text by key (bundled or platform), so tests name what the person reads. */
export function banglaText(messageKey: string): string {
  const text = BUNDLED_CATALOGS.bn[messageKey] ?? PLATFORM_SCREEN_CATALOGS.bn[messageKey];
  if (text === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return text;
}
