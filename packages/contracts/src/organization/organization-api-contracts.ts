import type { PostalAddress } from "../common/postal-address.js";
import type { PreferredLocale } from "../iam/preferred-locale.js";
import type { CountryCode } from "./country-code.js";
import type { CurrencyCode } from "./currency-code.js";
import type { InvitationStatus } from "./invitation-status.js";
import type { LocationStatus } from "./location-status.js";
import type { LocationType } from "./location-type.js";
import type { MemberStatus } from "./member-status.js";

/** The fields shown on invoices and the storefront (09-DOMAIN-MODEL section 4.2). */
export interface OrganizationProfileFields {
  legalName?: string | undefined;
  legalType?: string | undefined;
  phoneE164?: string | undefined;
  email?: string | undefined;
  address?: PostalAddress | undefined;
  tradeLicenseNumber?: string | undefined;
}

/** `GET /orgs/{organizationId}/profile` and the body of `PATCH /profile`. */
export interface OrganizationProfileResponse {
  organizationId: string;
  slug: string;
  name: string;
  defaultLocale: PreferredLocale;
  timezone: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  profile: OrganizationProfileFields;
  /**
   * Values of the organization's custom fields (ADR-107). Sensitive ones are left out unless the
   * caller holds `organization.profile.update` at every location.
   */
  customFields: Record<string, unknown>;
  version: number;
}

/** `PATCH /orgs/{organizationId}/profile`. Slug, currency, timezone and country are not editable here. */
export interface OrganizationProfileUpdateRequest {
  name?: string;
  defaultLocale?: PreferredLocale;
  profile?: OrganizationProfileFields;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. Checked against the organization's fields. */
  customFields?: Record<string, unknown>;
  version: number;
}

/** `POST /orgs/{organizationId}/locations`. */
export interface LocationCreateRequest {
  name: string;
  locationType: LocationType;
  address?: PostalAddress;
  phoneE164?: string;
  timezone?: string;
}

/** `PATCH /orgs/{organizationId}/locations/{locationId}`. */
export interface LocationUpdateRequest {
  name?: string;
  locationType?: LocationType;
  address?: PostalAddress;
  phoneE164?: string;
  timezone?: string;
  version: number;
}

/** Body of every location and member transition (archive, suspend, reactivate, remove). */
export interface VersionedTransitionRequest {
  version: number;
}

/** A location in lists and in the body of create, update and archive. */
export interface LocationResponse {
  locationId: string;
  name: string;
  locationType: LocationType;
  isDefault: boolean;
  status: LocationStatus;
  address?: PostalAddress;
  phoneE164?: string;
  timezone?: string;
  version: number;
}

/** `locationId` is a location ID or "ALL". */
export interface AssignmentRequest {
  locationId: string;
  roleId: string;
}

/** `PATCH /orgs/{organizationId}/members/{memberId}`. */
export interface MemberUpdateRequest {
  displayName?: string;
  jobTitle?: string;
  assignments?: AssignmentRequest[];
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. Checked against the member fields. */
  customFields?: Record<string, unknown>;
  version: number;
}

/** A member in lists, in the detail and in the body of every member change. */
export interface MemberResponse {
  memberId: string;
  userId: string;
  status: MemberStatus;
  displayName: string;
  jobTitle?: string;
  employeeNumber?: string;
  assignments: AssignmentRequest[];
  /**
   * Only in the detail (`GET /members/{memberId}`) and in the body of an update, never in the list.
   * Sensitive values are left out unless the caller holds `organization.member.readSensitive` at every location.
   */
  customFields?: Record<string, unknown>;
  joinedAt: string;
  version: number;
}

/** `POST /orgs/{organizationId}/invitations`: exactly one of email and phone. */
export interface InvitationCreateRequest {
  email?: string;
  phone?: string;
  displayName?: string;
  assignments: AssignmentRequest[];
}

/** An invitation in lists and in the body of revoke. The secret token is never part of it. */
export interface InvitationResponse {
  invitationId: string;
  email?: string;
  phoneE164?: string;
  displayName?: string;
  assignments: AssignmentRequest[];
  invitedByUserId: string;
  expiresAt: string;
  status: InvitationStatus;
  version: number;
}

/**
 * The body of `POST /invitations`. `inviteUrlPath` carries the secret token and is returned this
 * once; only its hash is stored, so it cannot be shown again.
 */
export interface InvitationCreatedResponse extends InvitationResponse {
  inviteUrlPath: string;
}

/** `GET /invitations/{token}` (public): enough for the invitee to recognise the invitation. */
export interface InvitationPreviewResponse {
  organizationName: string;
  invitedByDisplayName: string;
  /** The identifier with the middle masked, for example `r***@example.com`. */
  identifierHint: string;
  status: InvitationStatus;
}
