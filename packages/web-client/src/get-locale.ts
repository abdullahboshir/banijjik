import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@banijjik/i18n";
import { cookies } from "next/headers.js";

export const LOCALE_COOKIE_NAME = "locale";

export function resolveLocale(cookieValue: string | undefined): Locale {
  if (cookieValue !== undefined && isSupportedLocale(cookieValue)) return cookieValue;
  return DEFAULT_LOCALE;
}

/** Server only. Bangla unless the `locale` cookie holds another supported language (ADR-055). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
