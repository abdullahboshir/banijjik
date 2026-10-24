import { DEFAULT_LOCALE, isSupportedLocale } from "@banijjik/i18n";
import { LOCALE_COOKIE_NAME } from "@banijjik/web-client/server";
import { safeNextPath } from "@banijjik/web-client";
import { NextResponse, type NextRequest } from "next/server";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const SEE_OTHER = 303;

/** Switches the language: sets the `locale` cookie, then returns to the page the visitor was on. */
function switchLanguage(request: NextRequest): NextResponse {
  const requested = request.nextUrl.searchParams.get("to") ?? "";
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const destination = new URL(
    safeNextPath(request.nextUrl.searchParams.get("next")),
    request.nextUrl.origin,
  );
  const response = NextResponse.redirect(destination, SEE_OTHER);
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

export const GET = switchLanguage;
