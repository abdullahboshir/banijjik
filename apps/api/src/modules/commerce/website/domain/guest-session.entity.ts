import { GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS } from "@banijjik/contracts/website";

export function isGuestSessionExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function computeGuestSessionExpiry(now: Date): Date {
  const expiresAt = new Date(now.getTime());
  expiresAt.setDate(expiresAt.getDate() + GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS);
  return expiresAt;
}
