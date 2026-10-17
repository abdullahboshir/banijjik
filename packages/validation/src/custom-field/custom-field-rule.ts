import type {
  ContactRole,
  CustomFieldType,
  IndustryTemplateContactLink,
  CustomFieldValidationBounds,
  CustomFieldVisibility,
} from "@banijjik/contracts";

/** Who is reading or writing the values. A field hidden from that audience is not in the schema. */
export const CUSTOM_FIELD_AUDIENCE = {
  ADMIN: "ADMIN",
  STOREFRONT: "STOREFRONT",
  BOT: "BOT",
} as const;

export type CustomFieldAudience =
  (typeof CUSTOM_FIELD_AUDIENCE)[keyof typeof CUSTOM_FIELD_AUDIENCE];

export const CUSTOM_FIELD_VALUE_MODE = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
} as const;

export type CustomFieldValueMode =
  (typeof CUSTOM_FIELD_VALUE_MODE)[keyof typeof CUSTOM_FIELD_VALUE_MODE];

/**
 * The smallest description both an INDUSTRY field and an ORGANIZATION field can map to.
 * The value schema is built only from this, so it stays free of Node-only APIs (card 2.5 runs it in the browser).
 */
export interface CustomFieldRule {
  readonly fieldKey: string;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly visibility: CustomFieldVisibility;
  readonly isSensitive: boolean;
  readonly isSearchable: boolean;
  readonly options?: readonly string[];
  readonly validation?: CustomFieldValidationBounds;
  /** A REFERENCE field with a link also accepts `{ create: { name, phone } }` instead of a contact id (ADR-073). */
  readonly link?: IndustryTemplateContactLink;
  /** Contact fields only: the field belongs to these roles. Absent means every role (ADR-113). */
  readonly appliesToContactRoles?: readonly ContactRole[];
}

export interface CustomFieldValuesOptions {
  readonly audience: CustomFieldAudience;
  readonly mode: CustomFieldValueMode;
  /**
   * Admin forms set this so a contact-link field may carry `{ create }`. The server validates after the
   * contact module replaced it with an id, so a stored value is always a UUID (ADR-110).
   */
  readonly acceptsContactLinkCreate?: boolean;
  /**
   * Only the contact use cases set this: a field limited to other roles is not required and a value
   * sent for it is refused as not applicable. Without it every field applies (ADR-113).
   */
  readonly contactRoles?: readonly ContactRole[];
}

/** The message key of a value sent for a field the contact's roles do not use. */
export const NOT_APPLICABLE_MESSAGE_KEY = "validation.not_applicable";

/** Whether a contact with these roles uses the field. A field without roles belongs to every contact. */
export function fieldAppliesToContactRoles(
  field: Pick<CustomFieldRule, "appliesToContactRoles">,
  contactRoles: readonly ContactRole[],
): boolean {
  const limit = field.appliesToContactRoles;
  if (limit === undefined) return true;
  return limit.some((role) => contactRoles.includes(role));
}

export function isVisibleTo(field: CustomFieldRule, audience: CustomFieldAudience): boolean {
  if (audience === CUSTOM_FIELD_AUDIENCE.ADMIN) return field.visibility.admin;
  if (audience === CUSTOM_FIELD_AUDIENCE.STOREFRONT) return field.visibility.storefront;
  return field.visibility.bot;
}
