"use server";

import { isSupportedLocale } from "@banijjik/i18n";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "./get-locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Switches the language by setting the `locale` cookie for a year. Operators have no profile locale yet. */
export async function setLocaleAction(localeKey: string): Promise<boolean> {
  if (!isSupportedLocale(localeKey)) return false;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, localeKey, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
  return true;
}
