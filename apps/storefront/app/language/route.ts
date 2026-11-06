import { DEFAULT_LOCALE, isSupportedLocale } from "@banijjik/i18n";
import { LOCALE_COOKIE_NAME, safeNextPath } from "@banijjik/web-client/server";
import { NextResponse, type NextRequest } from "next/server";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const SEE_OTHER = 303;

function refererUrl(request: NextRequest, origin: string): URL | null {
  const referer = request.headers.get("referer");
  if (referer === null || !URL.canParse(referer)) return null;
  const parsed = new URL(referer);
  return parsed.origin === origin ? parsed : null;
}

function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.nextUrl.protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    return `https://${host}`;
  }
  return `${protocol}//${host}`;
}

/** Switches the language: sets the `locale` cookie, then returns to the page the visitor was on. */
function switchLanguage(request: NextRequest): NextResponse {
  const requested = request.nextUrl.searchParams.get("to") ?? "";
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const origin = requestOrigin(request);
  const referer = refererUrl(request, origin);
  const nextPath = request.nextUrl.searchParams.get("next");
  const fromReferer = referer === null ? null : `${referer.pathname}${referer.search}`;
  const destination = new URL(safeNextPath(nextPath ?? fromReferer), origin);
  const response = NextResponse.redirect(destination, SEE_OTHER);
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

export const GET = switchLanguage;
