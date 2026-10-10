"use server";

import type { MeResponse, MeUpdateRequest } from "@banijjik/contracts";
import { isSupportedLocale, type Locale } from "@banijjik/i18n";
import { cookies } from "next/headers";
import { serverApiFetch } from "../api/server-api-fetch";
import { LOCALE_COOKIE_NAME } from "./get-locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The cookie is what the UI reads; the profile is only kept in step for signed-in people. */
async function savePreferredLocale(locale: Locale): Promise<boolean> {
  try {
    const current = await serverApiFetch<MeResponse>("/me");
    const update: MeUpdateRequest = { preferredLocale: locale, version: current.data.version };
    await serverApiFetch<MeResponse>("/me", { method: "PATCH", body: update });
    return true;
  } catch {
    return false;
  }
}

export interface SetLocaleResult {
  isLocaleSet: boolean;
  isProfileUpdated: boolean;
}

/**
 * Switches the language: sets the `locale` cookie for a year, then updates the profile when the person is
 * signed in. A failed profile update never undoes the cookie (plan 1.7a decision 9).
 */
export async function setLocaleAction(localeKey: string): Promise<SetLocaleResult> {
  if (!isSupportedLocale(localeKey)) return { isLocaleSet: false, isProfileUpdated: false };
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, localeKey, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
  return { isLocaleSet: true, isProfileUpdated: await savePreferredLocale(localeKey) };
}
