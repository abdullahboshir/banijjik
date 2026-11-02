import { DEFAULT_LOCALE, isSupportedLocale } from "@banijjik/i18n";
import { LOCALE_COOKIE_NAME } from "@banijjik/web-client/server";
import { safeNextPath } from "@banijjik/web-client";
import { NextResponse, type NextRequest } from "next/server";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const SEE_OTHER = 303;

function refererUrl(request: NextRequest): URL | null {
  const referer = request.headers.get("referer");
  if (referer === null) return null;
  try {
    return new URL(referer);
  } catch {
    return null;
  }
}

function publicOrigin(request: NextRequest, referer: URL | null): string {
  if (referer !== null) return referer.origin;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? (request.nextUrl.protocol === "https:" ? "https" : "http");
  return `${proto}://${host}`;
}

/** Switches the language: sets the `locale` cookie, then returns to the page the visitor was on. */
function switchLanguage(request: NextRequest): NextResponse {
  const requested = request.nextUrl.searchParams.get("to") ?? "";
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const referer = refererUrl(request);
  const nextPath = request.nextUrl.searchParams.get("next");
  const fromReferer = referer === null ? null : `${referer.pathname}${referer.search}`;
  const destination = new URL(
    safeNextPath(nextPath ?? fromReferer),
    publicOrigin(request, referer),
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
