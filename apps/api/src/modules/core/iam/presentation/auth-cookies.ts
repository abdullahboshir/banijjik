import {
  ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@banijjik/contracts";
import type { CookieOptions, Response } from "express";
import type { IssuedSession } from "../application/session-issuer.js";

/**
 * The access cookie is sent on every request to the site, not only to the API, because the admin app
 * is server-rendered and its server components forward it to the API (plan 1.7a decision 1).
 * The refresh cookie still goes only to the auth routes.
 */
export const ACCESS_COOKIE_PATH = "/";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** The platform panel's own cookie pair (ADR-048): other names, and a refresh cookie that only the platform auth routes see. */
export const PLATFORM_REFRESH_COOKIE_PATH = "/api/v1/platform/auth";
export const PLATFORM_COOKIES = {
  accessCookieName: PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
  refreshCookieName: PLATFORM_REFRESH_TOKEN_COOKIE_NAME,
  refreshCookiePath: PLATFORM_REFRESH_COOKIE_PATH,
} as const;

export interface AuthCookieSettings {
  /** Cookies are Secure in production, where the API is served over HTTPS. */
  readonly isSecure: boolean;
  readonly domain?: string | undefined;
  readonly accessTokenTtlSeconds: number;
  /** Default to the admin app's cookie names and paths; the platform panel passes PLATFORM_COOKIES. */
  readonly accessCookieName?: string;
  readonly refreshCookieName?: string;
  readonly refreshCookiePath?: string;
}

const MILLISECONDS_PER_SECOND = 1000;

/** Writes the two auth cookies. Both are httpOnly and SameSite=Lax (plan 1.1 decision 13). */
export class AuthCookies {
  constructor(private readonly settings: AuthCookieSettings) {}

  set(response: Response, issued: IssuedSession, now: Date): void {
    const refreshMaxAgeMs = Math.max(0, issued.refreshTokenExpiresAt.getTime() - now.getTime());
    response.cookie(this.accessName(), issued.accessToken, {
      ...this.baseOptions(ACCESS_COOKIE_PATH),
      maxAge: this.settings.accessTokenTtlSeconds * MILLISECONDS_PER_SECOND,
    });
    response.cookie(this.refreshName(), issued.refreshToken, {
      ...this.baseOptions(this.refreshPath()),
      maxAge: refreshMaxAgeMs,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.accessName(), this.baseOptions(ACCESS_COOKIE_PATH));
    response.clearCookie(this.refreshName(), this.baseOptions(this.refreshPath()));
  }

  /** The name of the refresh cookie, for the controller that reads it back. */
  refreshName(): string {
    return this.settings.refreshCookieName ?? REFRESH_TOKEN_COOKIE_NAME;
  }

  private accessName(): string {
    return this.settings.accessCookieName ?? ACCESS_TOKEN_COOKIE_NAME;
  }

  private refreshPath(): string {
    return this.settings.refreshCookiePath ?? REFRESH_COOKIE_PATH;
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
