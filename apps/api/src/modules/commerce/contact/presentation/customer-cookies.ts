import {
  STOREFRONT_ACCESS_COOKIE_NAME,
  STOREFRONT_REFRESH_COOKIE_NAME,
} from "@banijjik/contracts/contact";
import type { CookieOptions, Response } from "express";
import type { IssuedCustomerSession } from "../application/customer-session-issuer.js";

/**
 * The access cookie goes to the whole site, because the storefront is server-rendered and forwards it
 * to the API. The refresh cookie only to the storefront API, so pages never see it. Both are host-only
 * (no Domain attribute): a business's cookie belongs to its own host and no other (ADR-119).
 */
export const CUSTOMER_ACCESS_COOKIE_PATH = "/";
export const CUSTOMER_REFRESH_COOKIE_PATH = "/api/v1/storefront";

const MILLISECONDS_PER_SECOND = 1000;

export interface CustomerCookieSettings {
  /** Cookies are Secure everywhere except local development. */
  readonly isSecure: boolean;
  readonly accessTokenTtlSeconds: number;
}

export class CustomerCookies {
  constructor(private readonly settings: CustomerCookieSettings) {}

  set(response: Response, issued: IssuedCustomerSession, now: Date): void {
    const refreshMaxAgeMs = Math.max(0, issued.refreshTokenExpiresAt.getTime() - now.getTime());
    response.cookie(STOREFRONT_ACCESS_COOKIE_NAME, issued.accessToken, {
      ...this.baseOptions(CUSTOMER_ACCESS_COOKIE_PATH),
      maxAge: this.settings.accessTokenTtlSeconds * MILLISECONDS_PER_SECOND,
    });
    response.cookie(STOREFRONT_REFRESH_COOKIE_NAME, issued.refreshToken, {
      ...this.baseOptions(CUSTOMER_REFRESH_COOKIE_PATH),
      maxAge: refreshMaxAgeMs,
    });
  }

  clear(response: Response): void {
    response.clearCookie(
      STOREFRONT_ACCESS_COOKIE_NAME,
      this.baseOptions(CUSTOMER_ACCESS_COOKIE_PATH),
    );
    response.clearCookie(
      STOREFRONT_REFRESH_COOKIE_NAME,
      this.baseOptions(CUSTOMER_REFRESH_COOKIE_PATH),
    );
  }

  private baseOptions(path: string): CookieOptions {
    return { httpOnly: true, sameSite: "lax", secure: this.settings.isSecure, path };
  }
}
