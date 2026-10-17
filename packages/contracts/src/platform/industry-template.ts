import { defineEnum } from "../define-enum.js";
import type { ContactRole } from "../contact/contact-role.js";
import type { RelationKey } from "../contact/relation-key.js";
import type { CustomFieldType } from "../custom-field/custom-field-type.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { OfferingKind } from "../modules/offering-kind.js";

/** Lifecycle of an industry template (12 section 1, ADR-075). */
export const INDUSTRY_TEMPLATE_STATUS = defineEnum(["DRAFT", "PUBLISHED", "RETIRED"]);

export type IndustryTemplateStatus =
  (typeof INDUSTRY_TEMPLATE_STATUS)[keyof typeof INDUSTRY_TEMPLATE_STATUS];

/** Plain text in both catalog languages. The client picks the one it shows. */
export interface LocalizedText {
  readonly bn: string;
  readonly en: string;
}

/** A REFERENCE field that creates or links a contact (ADR-073). */
export interface IndustryTemplateContactLink {
  readonly relationKey: RelationKey;
  readonly createIfMissingByPhone: boolean;
  readonly defaultBillTo: boolean;
}

/**
 * One custom field of a template seed. The field engine (card 2.3) interprets it.
 * Stored here so the seed is complete data.
 */
export interface IndustryTemplateCustomField {
  readonly entityType: string;
  readonly offeringKind?: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly botAsk: boolean;
  readonly visibility: {
    readonly admin: boolean;
    readonly storefront: boolean;
    readonly bot: boolean;
  };
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly options?: readonly string[] | undefined;
  /** Absent on older rows. The engine falls back to the field key (ADR-102). */
  readonly label?: LocalizedText | undefined;
  readonly optionLabels?: Readonly<Record<string, LocalizedText>> | undefined;
  readonly referenceEntity?: "contact" | "member" | undefined;
  readonly link?: IndustryTemplateContactLink | undefined;
}

/** A sample modifier group the tenant can edit (ADR-072). Prices are integer minor units. */
export interface IndustryTemplateModifierGroup {
  readonly name: string;
  readonly selection: "SINGLE" | "MULTIPLE";
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly { readonly name: string; readonly priceDeltaMinor: number }[];
}

export interface IndustryTemplateResourceType {
  readonly resourceTypeKey: string;
  readonly termKey: string;
  readonly isMember: boolean;
}

export interface IndustryTemplateKnowledgeStarter {
  readonly topicKey: string;
  readonly answer: LocalizedText;
}

export interface IndustryTemplateBotDefaults {
  readonly personaKey: string;
  readonly handoffTopics: readonly string[];
}

/**
 * The materialized configuration of one template (12 section 1, ADR-076).
 * Terms, fields and setting values are interpreted by cards 2.2, 2.3 and 2.4.
 */
export interface IndustryTemplateConfiguration {
  readonly contactRoleKeys: readonly ContactRole[];
  readonly relationKeys: readonly RelationKey[];
  readonly resourceTypes: readonly IndustryTemplateResourceType[];
  readonly terms: Readonly<Record<string, LocalizedText>>;
  readonly customFields: readonly IndustryTemplateCustomField[];
  readonly settingsDefaults: Readonly<Record<string, unknown>>;
  readonly modifierGroupsSeed?: readonly IndustryTemplateModifierGroup[] | undefined;
  readonly knowledgeSeed: readonly IndustryTemplateKnowledgeStarter[];
  readonly websiteTemplateKeys: readonly string[];
  readonly botDefaults: IndustryTemplateBotDefaults;
}

/** One card of `GET /industry-templates` (signup). */
export interface IndustryTemplateCard {
  readonly industryTemplateKey: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
}

/** One row of `GET /platform/industry-templates`. */
export interface PlatformIndustryTemplateSummary {
  readonly industryTemplateId: string;
  readonly industryTemplateKey: string;
  readonly status: IndustryTemplateStatus;
  readonly name: LocalizedText;
  readonly iconKey: string;
  readonly enabledKinds: readonly OfferingKind[];
  readonly allowedModuleKeys: readonly ModuleKey[];
  readonly version: number;
  readonly updatedAt: string;
}

/** `GET /platform/industry-templates/{industryTemplateId}`. */
export interface PlatformIndustryTemplateDetail extends PlatformIndustryTemplateSummary {
  readonly description: LocalizedText;
  readonly configuration: IndustryTemplateConfiguration;
  readonly createdAt: string;
  /**
   * `settingsDefaults` keys no registered module declares yet (ADR-106).
   * Computed on read; not stored.
   */
  readonly pendingSettingKeys: readonly string[];
  /**
   * At least one organization uses this template's key (ADR-112). A draft in use refuses removals like a
   * published one, so the editor shows its lock banner for it too.
   */
  readonly isInUse: boolean;
}

/**
 * `POST /platform/industry-templates`. A clone copies kinds, modules and configuration from
 * another template; otherwise those three fields are required. The server always stores DRAFT.
 */
export interface IndustryTemplateCreateRequest {
  readonly industryTemplateKey: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
  readonly reason: string;
  readonly enabledKinds?: readonly OfferingKind[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: IndustryTemplateConfiguration | undefined;
  readonly cloneFromIndustryTemplateId?: string | undefined;
}

/** `PATCH /platform/industry-templates/{industryTemplateId}`. The key and the status stay. */
export interface IndustryTemplateUpdateRequest {
  readonly version: number;
  readonly reason: string;
  readonly name?: LocalizedText | undefined;
  readonly description?: LocalizedText | undefined;
  readonly iconKey?: string | undefined;
  readonly enabledKinds?: readonly OfferingKind[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: IndustryTemplateConfiguration | undefined;
}

/** Body of publish and retire. */
export interface IndustryTemplateStatusRequest {
  readonly version: number;
  readonly reason: string;
}

/** `POST /platform/organizations/{organizationId}/change-industry-template`. */
export interface ChangeIndustryTemplateRequest {
  readonly industryTemplateKey: string;
  readonly reason: string;
}

/** The organization after a template move, or unchanged when the key was already current. */
export interface ChangeIndustryTemplateResponse {
  readonly organizationId: string;
  readonly industryTemplateKey: string;
  readonly configVersion: number;
  readonly version: number;
}
