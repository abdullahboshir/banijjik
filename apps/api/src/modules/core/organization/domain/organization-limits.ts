/** Interim abuse guard until a verified identifier is required to create organizations (plan 1.2 decision 11). */
export interface OrganizationRateLimit {
  readonly bucket: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

const ONE_DAY_SECONDS = 24 * 60 * 60;

export const ORGANIZATION_CREATE_PER_USER: OrganizationRateLimit = {
  bucket: "organization.create.user",
  limit: 5,
  windowSeconds: ONE_DAY_SECONDS,
};

/** `GET /me/orgs` returns every organization of the user; this bounds the read for an extreme account. */
export const MAX_ORGANIZATIONS_PER_USER_LISTING = 100;
