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

const ONE_MINUTE_SECONDS = 60;
const ONE_HOUR_SECONDS = 60 * 60;

/** The public invitation preview is open to anyone with a link, so it is limited per IP. */
export const INVITATION_PREVIEW_PER_IP: OrganizationRateLimit = {
  bucket: "invitation.preview.ip",
  limit: 30,
  windowSeconds: ONE_MINUTE_SECONDS,
};

/** Accepting is single-use per token; this only slows down a signed-in user guessing links. */
export const INVITATION_ACCEPT_PER_USER: OrganizationRateLimit = {
  bucket: "invitation.accept.user",
  limit: 10,
  windowSeconds: ONE_HOUR_SECONDS,
};
