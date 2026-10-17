import { defineEnum } from "../define-enum.js";
import type { ContactRole } from "./contact-role.js";
import type { RelationKey } from "./relation-key.js";

/** A person or a company (09 section 5.1). */
export const CONTACT_TYPE = defineEnum(["PERSON", "COMPANY"]);
export type ContactType = (typeof CONTACT_TYPE)[keyof typeof CONTACT_TYPE];

/** A contact is archived, never deleted: ledgers and requests keep pointing at it. */
export const CONTACT_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type ContactStatus = (typeof CONTACT_STATUS)[keyof typeof CONTACT_STATUS];

/** Where a contact came from. MANUAL is typed in by staff; LINKED is created through a contact-link field (ADR-073). */
export const CONTACT_SOURCE = defineEnum(["MANUAL", "LINKED"]);
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
export const CONTACT_API_MESSAGE_KEYS: readonly string[] = ["errors.contact_duplicate"];

/** Payload of every contact event: ids only, never the name or the phone. */
export interface ContactEventPayload {
  readonly contactId: string;
}
