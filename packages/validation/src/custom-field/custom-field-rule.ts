import type {
  CustomFieldType,
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
}

export interface CustomFieldValuesOptions {
  readonly audience: CustomFieldAudience;
  readonly mode: CustomFieldValueMode;
}

export function isVisibleTo(field: CustomFieldRule, audience: CustomFieldAudience): boolean {
  if (audience === CUSTOM_FIELD_AUDIENCE.ADMIN) return field.visibility.admin;
  if (audience === CUSTOM_FIELD_AUDIENCE.STOREFRONT) return field.visibility.storefront;
  return field.visibility.bot;
}
