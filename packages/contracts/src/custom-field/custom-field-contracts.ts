import type { OfferingKind } from "../modules/offering-kind.js";
import type { IndustryTemplateContactLink, LocalizedText } from "../platform/industry-template.js";
import type { CustomFieldEntityType } from "./custom-field-entity-type.js";
import type { CustomFieldType } from "./custom-field-type.js";

/** Where a field comes from. Tenants edit only ORGANIZATION fields (09 section 4.6). */
export const CUSTOM_FIELD_SCOPE = {
  INDUSTRY: "INDUSTRY",
  ORGANIZATION: "ORGANIZATION",
} as const;

export type CustomFieldScope = (typeof CUSTOM_FIELD_SCOPE)[keyof typeof CUSTOM_FIELD_SCOPE];

export const CUSTOM_FIELD_DEFINITION_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type CustomFieldDefinitionStatus =
  (typeof CUSTOM_FIELD_DEFINITION_STATUS)[keyof typeof CUSTOM_FIELD_DEFINITION_STATUS];

export interface CustomFieldVisibility {
  readonly admin: boolean;
  readonly storefront: boolean;
  readonly bot: boolean;
}

/** Bounds stored on a definition. No regular expression: a user-made pattern is a ReDoS risk (ADR-102). */
export interface CustomFieldValidationBounds {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly maxLength?: number | undefined;
}

export interface CustomFieldDefinitionCreateRequest {
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly label: LocalizedText;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation?: CustomFieldValidationBounds | undefined;
  readonly referenceEntity?: "contact" | "member" | undefined;
  readonly visibility: CustomFieldVisibility;
  readonly botAsk: boolean;
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
}

export interface CustomFieldDefinitionUpdateRequest {
  readonly version: number;
  readonly label?: LocalizedText | undefined;
  readonly isRequired?: boolean | undefined;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation?: CustomFieldValidationBounds | undefined;
  readonly visibility?: CustomFieldVisibility | undefined;
  readonly botAsk?: boolean | undefined;
  readonly isSearchable?: boolean | undefined;
  readonly isSensitive?: boolean | undefined;
  readonly sortOrder?: number | undefined;
}

export interface CustomFieldArchiveRequest {
  readonly version: number;
}

export interface CustomFieldPreferenceChange {
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly isHidden?: boolean | undefined;
  readonly label?: LocalizedText | undefined;
  readonly sortOrder?: number | undefined;
  readonly version?: number | undefined;
}

export interface CustomFieldPreferenceBatchRequest {
  readonly preferences: readonly CustomFieldPreferenceChange[];
}

export interface CustomFieldListQuery {
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind | undefined;
  readonly page: number;
  readonly limit: number;
}

/**
 * One row of the effective list: an INDUSTRY field with the organization's preferences applied,
 * or an ACTIVE ORGANIZATION field. `version` is the preference row's version, or 0 when the
 * organization has not saved a preference yet.
 */
export interface EffectiveCustomField {
  readonly scope: CustomFieldScope;
  readonly isEditable: boolean;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind;
  readonly fieldKey: string;
  readonly label: LocalizedText;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly options?: readonly string[];
  readonly optionLabels?: Readonly<Record<string, LocalizedText>>;
  readonly validation?: CustomFieldValidationBounds;
  readonly referenceEntity?: "contact" | "member";
  /** Set on a template REFERENCE field that creates or links a contact (ADR-073). Organization fields never carry it. */
  readonly link?: IndustryTemplateContactLink;
  readonly visibility: CustomFieldVisibility;
  readonly botAsk: boolean;
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
  readonly customFieldDefinitionId?: string;
  readonly version: number;
  readonly status: CustomFieldDefinitionStatus;
  /**
   * Set (true) only on a template field the business hid, and only in the management list
   * (`GET /custom-fields`), so the business can show it again (ADR-108). Forms and `/me/config`
   * never carry a hidden field.
   */
  readonly isHidden?: true;
}

/** Ids only. A consumer reads the definition through this module (ADR-090). */
export interface CustomFieldDefinitionChangedPayload {
  readonly entityType: CustomFieldEntityType;
  readonly fieldKey: string;
}
