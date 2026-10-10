/** Rules for the organization slug in URLs and subdomains (plan 1.2 decision 7). */
export const ORGANIZATION_SLUG_MIN_LENGTH = 3;
export const ORGANIZATION_SLUG_MAX_LENGTH = 40;

/** Lower-case letters and digits, single hyphens between them, none at the start or end. */
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ORGANIZATION_NAME_MIN_LENGTH = 2;
export const ORGANIZATION_NAME_MAX_LENGTH = 80;

/** Words that would clash with a route, a subdomain or the platform's own pages. */
export const RESERVED_ORGANIZATION_SLUGS: readonly string[] = [
  "api",
  "admin",
  "app",
  "www",
  "platform",
  "storefront",
  "shop",
  "static",
  "assets",
  "cdn",
  "help",
  "support",
  "docs",
  "status",
  "mail",
  "email",
  "login",
  "logout",
  "signup",
  "register",
  "auth",
  "me",
  "orgs",
  "settings",
  "billing",
  "account",
  "dashboard",
  "new",
  "test",
  "demo",
  "banijjik",
];

/** A slug is compared trimmed and lower-cased, so "  Rahim-Store " and "rahim-store" are the same slug. */
export function normalizeOrganizationSlug(slug: string): string {
  return slug.trim().toLowerCase();
}
