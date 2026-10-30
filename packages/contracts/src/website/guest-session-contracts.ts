export const SF_GUEST_COOKIE_NAME = "sf_guest";
export const GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS = 30;
export const GUEST_SESSION_SECRET_BYTES = 32;
export const WEBSITE_GUEST_CHECKOUT_SETTING_KEY = "website.guestCheckout";

export interface GuestSessionResponse {
  readonly guestSessionId: string;
  readonly expiresAt: string; // ISO 8601
}

export interface GuestSessionEntity {
  readonly guestSessionId: string;
  readonly organizationId: string;
  readonly secretHash: string; // SHA-256
  readonly expiresAt: Date;
  readonly provisionalContactId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateGuestSessionResult {
  readonly guestSessionId: string;
  readonly rawSecret: string; // 32 random bytes hex encoded
  readonly expiresAt: Date;
}

export function formatGuestCookie(guestSessionId: string, rawSecret: string): string {
  return `${guestSessionId}.${rawSecret}`;
}

export function parseGuestCookie(
  cookieValue: string | undefined | null,
): { guestSessionId: string; rawSecret: string } | null {
  if (!cookieValue || typeof cookieValue !== "string") {
    return null;
  }
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex <= 0 || dotIndex === cookieValue.length - 1) {
    return null;
  }
  const guestSessionId = cookieValue.slice(0, dotIndex);
  const rawSecret = cookieValue.slice(dotIndex + 1);
  return { guestSessionId, rawSecret };
}
