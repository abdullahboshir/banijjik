import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@banijjik/contracts";
import type { CookieOptions, Response } from "express";
import type { IssuedSession } from "../application/session-issuer.js";

/**
 * The access cookie is sent on every request to the site, not only to the API, because the admin app
 * is server-rendered and its server components forward it to the API (plan 1.7a decision 1).
 * The refresh cookie still goes only to the auth routes.
 */
export const ACCESS_COOKIE_PATH = "/";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export interface AuthCookieSettings {
  /** Cookies are Secure in production, where the API is served over HTTPS. */
  readonly isSecure: boolean;
  readonly domain?: string | undefined;
  readonly accessTokenTtlSeconds: number;
}

const MILLISECONDS_PER_SECOND = 1000;

/** Writes the two auth cookies. Both are httpOnly and SameSite=Lax (plan 1.1 decision 13). */
export class AuthCookies {
  constructor(private readonly settings: AuthCookieSettings) {}

  set(response: Response, issued: IssuedSession, now: Date): void {
    const refreshMaxAgeMs = Math.max(0, issued.refreshTokenExpiresAt.getTime() - now.getTime());
    response.cookie(ACCESS_TOKEN_COOKIE_NAME, issued.accessToken, {
      ...this.baseOptions(ACCESS_COOKIE_PATH),
      maxAge: this.settings.accessTokenTtlSeconds * MILLISECONDS_PER_SECOND,
    });
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, issued.refreshToken, {
      ...this.baseOptions(REFRESH_COOKIE_PATH),
      maxAge: refreshMaxAgeMs,
    });
  }

  clear(response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE_NAME, this.baseOptions(ACCESS_COOKIE_PATH));
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.baseOptions(REFRESH_COOKIE_PATH));
  }

  private baseOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.settings.isSecure,
      path,
      ...(this.settings.domain === undefined ? {} : { domain: this.settings.domain }),
    };
  }
}
