import {
  CONTACT_ROLE,
  RELATION_KEY,
  type ContactRole,
  type RelationKey,
} from "@banijjik/contracts";
import {
  CONTACT_SOURCE,
  CONTACT_STATUS,
  CONTACT_TYPE,
  type ContactSource,
  type ContactStatus,
  type ContactType,
} from "@banijjik/contracts/contact";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { CustomFieldSearchEntry } from "../domain/custom-field-values.js";

export const CONTACT_MODEL_NAME = "Contact";
export const CONTACT_COLLECTION_NAME = "contacts";

export interface ContactAddressDocument {
  addressId: string;
  label: string;
  line1: string;
  area?: string;
  thana?: string;
  district?: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface ContactRelationDocument {
  relatedContactId: string;
  relationKey: RelationKey;
}

/** Counters fed by events from requests and payments (cards 3.5 to 3.8). The contact use cases never write them. */
export interface ContactSummaryDocument {
  requestCount: number;
  lifetimeValueMinor: number;
  lastActivityAt: Date | null;
  codReturnCount: number;
}

export interface ContactDocument {
  contactId: string;
  organizationId: string;
  contactType: ContactType;
  name?: string;
  /** Lower-cased, Bangla-folded copy of the name, for prefix search. */
  nameSearch?: string;
  phoneE164?: string;
  additionalPhonesE164: string[];
  email?: string;
  contactRoles: ContactRole[];
  addresses: ContactAddressDocument[];
  relations: ContactRelationDocument[];
  tagKeys: string[];
  homeLocationId?: string;
  summary: ContactSummaryDocument;
  customFields?: Record<string, unknown>;
  customFieldSearch?: CustomFieldSearchEntry[];
  source: ContactSource;
  status: ContactStatus;
  anonymizedAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const addressSchema = new Schema<ContactAddressDocument>(
  {
    addressId: { type: String, required: true },
    label: { type: String, required: true },
    line1: { type: String, required: true },
    area: { type: String },
    thana: { type: String },
    district: { type: String },
    postalCode: { type: String },
    isDefault: { type: Boolean, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const relationSchema = new Schema<ContactRelationDocument>(
  {
    relatedContactId: { type: String, required: true },
    relationKey: { type: String, required: true, enum: Object.values(RELATION_KEY) },
  },
  SUB_SCHEMA_OPTIONS,
);

const summarySchema = new Schema<ContactSummaryDocument>(
  {
    requestCount: { type: Number, required: true, default: 0 },
    lifetimeValueMinor: { type: Number, required: true, default: 0 },
    lastActivityAt: { type: Date, default: null },
    codReturnCount: { type: Number, required: true, default: 0 },
  },
  SUB_SCHEMA_OPTIONS,
);

const customFieldSearchSchema = new Schema<CustomFieldSearchEntry>(
  {
    fieldKey: { type: String, required: true },
    value: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const contactSchema = new Schema<ContactDocument>(
  {
    ...domainIdField("contactId"),
    organizationId: { type: String, required: true, immutable: true },
    contactType: { type: String, required: true, enum: Object.values(CONTACT_TYPE) },
    name: { type: String },
    nameSearch: { type: String },
    phoneE164: { type: String },
    additionalPhonesE164: { type: [String], default: [] },
    email: { type: String },
    contactRoles: {
      type: [{ type: String, enum: Object.values(CONTACT_ROLE) }],
      default: [],
    },
    addresses: { type: [addressSchema], default: [] },
    relations: { type: [relationSchema], default: [] },
    tagKeys: { type: [String], default: [] },
    homeLocationId: { type: String },
    summary: { type: summarySchema, default: () => ({}) },
    customFields: { type: Schema.Types.Mixed },
    customFieldSearch: { type: [customFieldSearchSchema] },
    source: { type: String, required: true, enum: Object.values(CONTACT_SOURCE) },
    status: { type: String, required: true, enum: Object.values(CONTACT_STATUS) },
    anonymizedAt: { type: Date },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

contactSchema.index({ organizationId: 1, contactId: 1 }, { unique: true });
// One ACTIVE contact per phone: the safety net behind the duplicate check (concurrent creates). An archived contact frees its phone.
contactSchema.index(
  { organizationId: 1, phoneE164: 1 },
  {
    unique: true,
    partialFilterExpression: { status: CONTACT_STATUS.ACTIVE, phoneE164: { $exists: true } },
  },
);
contactSchema.index(
  { organizationId: 1, email: 1 },
  { partialFilterExpression: { email: { $exists: true } } },
);
// The list by role, newest first, and the same list without a role.
contactSchema.index({ organizationId: 1, status: 1, contactRoles: 1, updatedAt: -1 });
contactSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
// Name prefix search, and phone prefix search over any status (the unique index above covers ACTIVE only).
contactSchema.index({ organizationId: 1, nameSearch: 1 });
contactSchema.index({ organizationId: 1, status: 1, phoneE164: 1 });
// Finds contacts by a searchable custom field value (attribute pattern, ADR-102 and ADR-107).
contactSchema.index({
  organizationId: 1,
  "customFieldSearch.fieldKey": 1,
  "customFieldSearch.value": 1,
});
