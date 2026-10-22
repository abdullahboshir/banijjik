import { defineEnum } from "../define-enum.js";
import type { ContactRole } from "./contact-role.js";
import type { RelationKey } from "./relation-key.js";

/** A person or a company (09 section 5.1). */
export const CONTACT_TYPE = defineEnum(["PERSON", "COMPANY"]);
export type ContactType = (typeof CONTACT_TYPE)[keyof typeof CONTACT_TYPE];

/** A contact is archived, never deleted: ledgers and requests keep pointing at it. */
export const CONTACT_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type ContactStatus = (typeof CONTACT_STATUS)[keyof typeof CONTACT_STATUS];

/**
 * Where a contact came from. MANUAL is typed in by staff; LINKED is created through a contact-link
 * field (ADR-073); STOREFRONT is created when a customer signs in to the business's public site (M.1).
 */
export const CONTACT_SOURCE = defineEnum(["MANUAL", "LINKED", "STOREFRONT"]);
export type ContactSource = (typeof CONTACT_SOURCE)[keyof typeof CONTACT_SOURCE];

/** What makes a second contact a duplicate of the first (setting `contact.dedupeOn`). */
export const CONTACT_DEDUPE_MODE = defineEnum(["PHONE", "PHONE_OR_EMAIL"]);
export type ContactDedupeMode = (typeof CONTACT_DEDUPE_MODE)[keyof typeof CONTACT_DEDUPE_MODE];

export const CONTACT_DEDUPE_SETTING_KEY = "contact.dedupeOn";

export const CONTACT_NAME_MAX_LENGTH = 120;
export const CONTACT_ANONYMIZE_REASON_MAX_LENGTH = 300;

export interface ContactAddress {
  addressId: string;
  label: string;
  line1: string;
  area?: string | undefined;
  thana?: string | undefined;
  district?: string | undefined;
  postalCode?: string | undefined;
  isDefault: boolean;
}

/** The input shape of an address: a known `addressId` is kept, a missing one is issued by the server. */
export type ContactAddressInput = Omit<ContactAddress, "addressId"> & {
  addressId?: string | undefined;
};

export interface ContactRelation {
  relatedContactId: string;
  relationKey: RelationKey;
}

/** A relation as `GET /contacts/{contactId}` returns it, with the related contact's name (one batched read). */
export interface ContactRelationView extends ContactRelation {
  relatedContactName: string | null;
}

/** One row of `GET /contacts`: no custom fields, no addresses. */
export interface ContactListItem {
  contactId: string;
  name: string | null;
  phoneE164: string | null;
  contactRoles: ContactRole[];
  tagKeys: string[];
  status: ContactStatus;
  updatedAt: string;
}

export interface ContactSummary {
  readonly requestCount: number;
  readonly lifetimeValueMinor: number;
  readonly lastActivityAt: string | null;
  readonly codReturnCount: number;
  readonly storeCreditBalanceMinor: number;
}

export interface ContactResponse {
  contactId: string;
  contactType: ContactType;
  name: string | null;
  phoneE164: string | null;
  additionalPhonesE164: string[];
  email: string | null;
  contactRoles: ContactRole[];
  addresses: ContactAddress[];
  relations: ContactRelationView[];
  tagKeys: string[];
  homeLocationId: string | null;
  /** Sensitive values only with `contact.contact.readSensitive` at every location (ADR-107). */
  customFields: Record<string, unknown>;
  summary?: ContactSummary;
  source: ContactSource;
  status: ContactStatus;
  /** Set once the contact's personal data was erased (anonymize); null otherwise. */
  anonymizedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** `POST /orgs/{organizationId}/contacts`. */
export interface ContactCreateRequest {
  contactType: ContactType;
  name?: string;
  phoneE164?: string;
  additionalPhonesE164?: string[];
  email?: string;
  contactRoles: ContactRole[];
  addresses?: ContactAddressInput[];
  tagKeys?: string[];
  homeLocationId?: string;
  customFields?: Record<string, unknown>;
}

/** `PATCH /contacts/{contactId}`. `null` clears an optional field; an absent key leaves it. */
export interface ContactUpdateRequest {
  contactType?: ContactType;
  name?: string | null;
  phoneE164?: string | null;
  additionalPhonesE164?: string[];
  email?: string | null;
  contactRoles?: ContactRole[];
  addresses?: ContactAddressInput[];
  tagKeys?: string[];
  homeLocationId?: string | null;
  customFields?: Record<string, unknown>;
  version: number;
}

/** `POST /contacts/{contactId}/anonymize`. */
export interface ContactAnonymizeRequest {
  version: number;
  reason: string;
}

/** `{ create }` in a contact-link field: the server links an existing contact with this phone or creates one. */
export interface ContactLinkCreateInput {
  create: { name: string; phone: string };
}

/** Message keys the contact endpoints can send to a client. Both catalogs need each. */
export const CONTACT_API_MESSAGE_KEYS: readonly string[] = [
  "errors.contact_duplicate",
  "errors.otp_invalid",
  "errors.customer_account_blocked",
  "errors.storefront_not_available",
];

/** Setting `contact.customerLogin` (BOOLEAN, default false): whether customers may sign in to the public site (M.1, ADR-119). */
export const CUSTOMER_LOGIN_SETTING_KEY = "contact.customerLogin";

/** A BLOCKED account cannot sign in and loses its sessions; staff can unblock it. */
export const CUSTOMER_ACCOUNT_STATUS = defineEnum(["ACTIVE", "BLOCKED"]);
export type CustomerAccountStatus =
  (typeof CUSTOMER_ACCOUNT_STATUS)[keyof typeof CUSTOMER_ACCOUNT_STATUS];

/** The customer's own cookies, apart from the admin ones (ADR-048, ADR-119). */
export const STOREFRONT_ACCESS_COOKIE_NAME = "sf_access";
export const STOREFRONT_REFRESH_COOKIE_NAME = "sf_refresh";

/** The rules of the one-time code (ADR-119). */
export const CUSTOMER_OTP_RULES = {
  codeLength: 6,
  expiresInSeconds: 300,
  maxWrongAttempts: 5,
  sendsPerPhone: { limit: 3, windowSeconds: 900 },
  sendsPerIp: { limit: 10, windowSeconds: 3600 },
  verifiesPerIp: { limit: 20, windowSeconds: 3600 },
  sessionDays: 30,
  /** A refresh token shown again this soon after its replacement is a race of two requests, not theft (as for admin sessions). */
  refreshReuseGraceSeconds: 10,
  accessTokenSeconds: 900,
} as const;

/** `POST …/auth/otp/send`: always answered with 202, whether or not an account exists. */
export interface CustomerOtpSendResponse {
  expiresInSeconds: number;
}

/** `GET …/me` of a signed-in customer. */
export interface StorefrontMeResponse {
  customerAccountId: string;
  contactId: string;
  phoneE164: string;
  name: string | null;
}

/** `GET /contacts/{contactId}/customer-account`: what staff see of a customer's website login. */
export interface CustomerAccountResponse {
  customerAccountId: string;
  contactId: string;
  status: CustomerAccountStatus;
  verifiedAt: string | null;
  lastLoginAt: string | null;
  blockedAt: string | null;
  version: number;
}

/** `POST …/customer-account/block` and `/unblock`. */
export interface CustomerAccountBlockRequest {
  version: number;
}

/** Payload of `contact.customerOtp.requested`: ids only, never the phone or the code (ADR-119). */
export interface CustomerOtpRequestedPayload {
  readonly otpChallengeId: string;
}

/** Payload of the customer-account events: ids only. */
export interface CustomerAccountEventPayload {
  readonly customerAccountId: string;
  readonly contactId: string;
}

/** Payload of every contact event: ids only, never the name or the phone. */
export interface ContactEventPayload {
  readonly contactId: string;
}
