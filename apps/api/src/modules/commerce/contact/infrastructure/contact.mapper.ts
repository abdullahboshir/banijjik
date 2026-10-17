import type { ContactAddress, ContactRelation } from "@banijjik/contracts/contact";
import {
  asId,
  type ContactId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Contact } from "../domain/contact.entity.js";
import { foldName } from "../domain/name-search.js";
import type {
  ContactAddressDocument,
  ContactDocument,
  ContactRelationDocument,
} from "./contact.schema.js";

const EMPTY_SUMMARY = {
  requestCount: 0,
  lifetimeValueMinor: 0,
  lastActivityAt: null,
  codReturnCount: 0,
} as const;

/** Optional fields that are absent are left out, not stored as null. */
function toAddressDocument(address: ContactAddress): ContactAddressDocument {
  return {
    addressId: address.addressId,
    label: address.label,
    line1: address.line1,
    isDefault: address.isDefault,
    ...(address.area === undefined ? {} : { area: address.area }),
    ...(address.thana === undefined ? {} : { thana: address.thana }),
    ...(address.district === undefined ? {} : { district: address.district }),
    ...(address.postalCode === undefined ? {} : { postalCode: address.postalCode }),
  };
}

function toAddress(document: ContactAddressDocument): ContactAddress {
  return {
    addressId: document.addressId,
    label: document.label,
    line1: document.line1,
    isDefault: document.isDefault,
    area: document.area,
    thana: document.thana,
    district: document.district,
    postalCode: document.postalCode,
  };
}

function toRelationDocument(relation: ContactRelation): ContactRelationDocument {
  return { relatedContactId: relation.relatedContactId, relationKey: relation.relationKey };
}

/** The fields an edit sets. Optional ones that became absent are unset by the repository. */
export type EditableFields = Pick<
  ContactDocument,
  | "contactType"
  | "additionalPhonesE164"
  | "contactRoles"
  | "addresses"
  | "relations"
  | "tagKeys"
  | "customFields"
  | "customFieldSearch"
  | "status"
>;

export interface OptionalFields {
  readonly name: string | undefined;
  readonly nameSearch: string | undefined;
  readonly phoneE164: string | undefined;
  readonly email: string | undefined;
  readonly homeLocationId: string | undefined;
  readonly anonymizedAt: Date | undefined;
}

export function contactEditableFields(contact: Contact): EditableFields {
  return {
    contactType: contact.contactType,
    additionalPhonesE164: [...contact.additionalPhonesE164],
    contactRoles: [...contact.contactRoles],
    addresses: contact.addresses.map(toAddressDocument),
    relations: contact.relations.map(toRelationDocument),
    tagKeys: [...contact.tagKeys],
    customFields: { ...contact.customFields },
    customFieldSearch: contact.customFieldSearch.map((entry) => ({ ...entry })),
    status: contact.status,
  };
}

/** The optional fields of a contact, present or absent, so the repository can set or unset each. */
export function contactOptionalFields(contact: Contact): OptionalFields {
  return {
    name: contact.name,
    nameSearch: contact.name === undefined ? undefined : foldName(contact.name),
    phoneE164: contact.phoneE164,
    email: contact.email,
    homeLocationId: contact.homeLocationId,
    anonymizedAt: contact.anonymizedAt,
  };
}

export function toContactDocument(contact: Contact): ContactDocument {
  const optional = contactOptionalFields(contact);
  return {
    contactId: contact.contactId,
    organizationId: contact.organizationId,
    ...contactEditableFields(contact),
    summary: { ...EMPTY_SUMMARY },
    source: contact.source,
    version: contact.version,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    createdByUserId: contact.createdByUserId,
    updatedByUserId: null,
    ...(optional.name === undefined ? {} : { name: optional.name }),
    ...(optional.nameSearch === undefined ? {} : { nameSearch: optional.nameSearch }),
    ...(optional.phoneE164 === undefined ? {} : { phoneE164: optional.phoneE164 }),
    ...(optional.email === undefined ? {} : { email: optional.email }),
    ...(optional.homeLocationId === undefined ? {} : { homeLocationId: optional.homeLocationId }),
    ...(optional.anonymizedAt === undefined ? {} : { anonymizedAt: optional.anonymizedAt }),
  };
}

export function toContact(document: ContactDocument): Contact {
  const stored = stripMongoInternals(document);
  return Contact.restore({
    contactId: asId<ContactId>(stored.contactId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    contactType: stored.contactType,
    name: stored.name,
    phoneE164: stored.phoneE164,
    additionalPhonesE164: stored.additionalPhonesE164,
    email: stored.email,
    contactRoles: stored.contactRoles,
    addresses: stored.addresses.map(toAddress),
    relations: stored.relations.map((relation) => ({ ...relation })),
    tagKeys: stored.tagKeys,
    homeLocationId:
      stored.homeLocationId === undefined ? undefined : asId<LocationId>(stored.homeLocationId),
    customFields: stored.customFields ?? {},
    customFieldSearch: stored.customFieldSearch ?? [],
    source: stored.source,
    status: stored.status,
    anonymizedAt: stored.anonymizedAt,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
  });
}
