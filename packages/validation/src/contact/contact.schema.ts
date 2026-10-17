import { CONTACT_ROLE } from "@banijjik/contracts";
import {
  CONTACT_ANONYMIZE_REASON_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_STATUS,
  CONTACT_TYPE,
} from "@banijjik/contracts/contact";
import { z } from "zod";
import { emailSchema } from "../email.js";
import {
  customFieldValuesRequestSchema,
  versionSchema,
} from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const ADDRESS_LABEL_MAX_LENGTH = 40;
const ADDRESS_PART_MAX_LENGTH = 120;
const POSTAL_CODE_MAX_LENGTH = 20;
const TAG_KEY_MAX_LENGTH = 40;
const MAX_ADDITIONAL_PHONES = 5;
const MAX_ADDRESSES = 10;
const MAX_TAGS = 20;
const SEARCH_MAX_LENGTH = 80;

const nameSchema = z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH);
const addressPartSchema = z.string().trim().min(1).max(ADDRESS_PART_MAX_LENGTH);

const addressSchema = z.strictObject({
  addressId: uuidV7Schema.optional(),
  label: z.string().trim().min(1).max(ADDRESS_LABEL_MAX_LENGTH),
  line1: addressPartSchema,
  area: addressPartSchema.optional(),
  thana: addressPartSchema.optional(),
  district: addressPartSchema.optional(),
  postalCode: z.string().trim().min(1).max(POSTAL_CODE_MAX_LENGTH).optional(),
  isDefault: z.boolean(),
});

const addressesSchema = z
  .array(addressSchema)
  .max(MAX_ADDRESSES)
  .refine((addresses) => addresses.filter((address) => address.isDefault).length <= 1);

const contactRolesSchema = z
  .array(z.enum(CONTACT_ROLE))
  .min(1)
  .refine((roles) => new Set(roles).size === roles.length);

const additionalPhonesSchema = z.array(phoneE164Schema).max(MAX_ADDITIONAL_PHONES);

const tagKeysSchema = z
  .array(z.string().trim().min(1).max(TAG_KEY_MAX_LENGTH))
  .max(MAX_TAGS)
  .refine((tags) => new Set(tags).size === tags.length);

/** A contact needs a name or a phone (09 section 5.1). */
function hasNameOrPhone(body: {
  name?: string | undefined;
  phoneE164?: string | undefined;
}): boolean {
  return body.name !== undefined || body.phoneE164 !== undefined;
}

/** Body of `POST /orgs/{organizationId}/contacts`. */
export const contactCreateRequestSchema = z
  .strictObject({
    contactType: z.enum(CONTACT_TYPE),
    name: nameSchema.optional(),
    phoneE164: phoneE164Schema.optional(),
    additionalPhonesE164: additionalPhonesSchema.optional(),
    email: emailSchema.optional(),
    contactRoles: contactRolesSchema,
    addresses: addressesSchema.optional(),
    tagKeys: tagKeysSchema.optional(),
    homeLocationId: uuidV7Schema.optional(),
    customFields: customFieldValuesRequestSchema.optional(),
  })
  .refine(hasNameOrPhone, { path: ["name"] });
export type ContactCreateBody = z.output<typeof contactCreateRequestSchema>;

/**
 * Body of `PATCH /contacts/{contactId}`; at least one field besides `version`. `null` clears the name,
 * phone, email or home location; an absent key leaves the field alone. Lists replace the stored list.
 */
export const contactUpdateRequestSchema = z
  .strictObject({
    contactType: z.enum(CONTACT_TYPE).optional(),
    name: nameSchema.nullable().optional(),
    phoneE164: phoneE164Schema.nullable().optional(),
    additionalPhonesE164: additionalPhonesSchema.optional(),
    email: emailSchema.nullable().optional(),
    contactRoles: contactRolesSchema.optional(),
    addresses: addressesSchema.optional(),
    tagKeys: tagKeysSchema.optional(),
    homeLocationId: uuidV7Schema.nullable().optional(),
    customFields: customFieldValuesRequestSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type ContactUpdateBody = z.output<typeof contactUpdateRequestSchema>;

/** Body of `POST /contacts/{contactId}/anonymize`. */
export const contactAnonymizeRequestSchema = z.strictObject({
  version: versionSchema,
  reason: z.string().trim().min(1).max(CONTACT_ANONYMIZE_REASON_MAX_LENGTH),
});
export type ContactAnonymizeBody = z.output<typeof contactAnonymizeRequestSchema>;

export const contactIdParamsSchema = z.object({ contactId: uuidV7Schema });

/** `?q=&role=&tag=&status=&page=&limit=` of `GET /contacts`. The status defaults to ACTIVE. */
export const contactListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
  role: z.enum(CONTACT_ROLE).optional(),
  tag: z.string().trim().min(1).max(TAG_KEY_MAX_LENGTH).optional(),
  status: z.enum(CONTACT_STATUS).default(CONTACT_STATUS.ACTIVE),
});
export type ContactListQuery = z.output<typeof contactListQuerySchema>;
