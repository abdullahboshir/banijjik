import {
  CUSTOM_FIELD_DEFINITION_STATUS,
  type ContactRole,
  CUSTOM_FIELD_TYPE,
  type CustomFieldDefinitionStatus,
  type CustomFieldEntityType,
  type CustomFieldType,
  type CustomFieldValidationBounds,
  type CustomFieldVisibility,
  type LocalizedText,
  type OfferingKind,
} from "@banijjik/contracts";
import { newId, type Id, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField, optionsLocked, recordNotFound } from "./errors.js";

export type CustomFieldDefinitionId = Id<"CustomFieldDefinition">;

const INITIAL_VERSION = 1;

export interface CustomFieldDefinitionProps {
  readonly customFieldDefinitionId: CustomFieldDefinitionId;
  readonly organizationId: OrganizationId;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly label: LocalizedText;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly options: readonly string[] | undefined;
  readonly optionLabels: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation: CustomFieldValidationBounds | undefined;
  readonly referenceEntity: "contact" | "member" | undefined;
  /** Contact fields only; absent means every role (ADR-113). */
  readonly appliesToContactRoles: readonly ContactRole[] | undefined;
  readonly visibility: CustomFieldVisibility;
  readonly botAsk: boolean;
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
  readonly status: CustomFieldDefinitionStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export interface NewCustomFieldDefinitionInput {
  readonly organizationId: OrganizationId;
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
  readonly appliesToContactRoles?: readonly ContactRole[] | undefined;
  readonly visibility: CustomFieldVisibility;
  readonly botAsk: boolean;
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface CustomFieldDefinitionChanges {
  readonly label?: LocalizedText | undefined;
  readonly isRequired?: boolean | undefined;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation?: CustomFieldValidationBounds | undefined;
  /** A list sets the roles; null goes back to every role. */
  readonly appliesToContactRoles?: readonly ContactRole[] | null | undefined;
  readonly visibility?: CustomFieldVisibility | undefined;
  readonly botAsk?: boolean | undefined;
  readonly isSearchable?: boolean | undefined;
  readonly isSensitive?: boolean | undefined;
  readonly sortOrder?: number | undefined;
}

function keepsEveryOption(existing: readonly string[], next: readonly string[]): boolean {
  return existing.every((option) => next.includes(option));
}

function assertOptionLabelsFit(
  options: readonly string[] | undefined,
  optionLabels: Readonly<Record<string, LocalizedText>> | undefined,
): void {
  if (optionLabels === undefined) return;
  const known = new Set(options ?? []);
  const unknown = Object.keys(optionLabels).some((key) => !known.has(key));
  if (unknown) throw invalidField("optionLabels", "validation.invalid_value");
}

/** An organization-made field. The key and the type never change; archive instead of delete (ADR-102). */
export class CustomFieldDefinition implements CustomFieldDefinitionProps {
  readonly customFieldDefinitionId: CustomFieldDefinitionId;
  readonly organizationId: OrganizationId;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly label: LocalizedText;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly options: readonly string[] | undefined;
  readonly optionLabels: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation: CustomFieldValidationBounds | undefined;
  readonly referenceEntity: "contact" | "member" | undefined;
  /** Contact fields only; absent means every role (ADR-113). */
  readonly appliesToContactRoles: readonly ContactRole[] | undefined;
  readonly visibility: CustomFieldVisibility;
  readonly botAsk: boolean;
  readonly isSearchable: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
  readonly status: CustomFieldDefinitionStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  private constructor(props: CustomFieldDefinitionProps) {
    this.customFieldDefinitionId = props.customFieldDefinitionId;
    this.organizationId = props.organizationId;
    this.entityType = props.entityType;
    this.offeringKind = props.offeringKind;
    this.fieldKey = props.fieldKey;
    this.label = props.label;
    this.fieldType = props.fieldType;
    this.isRequired = props.isRequired;
    this.options = props.options;
    this.optionLabels = props.optionLabels;
    this.validation = props.validation;
    this.referenceEntity = props.referenceEntity;
    this.appliesToContactRoles = props.appliesToContactRoles;
    this.visibility = props.visibility;
    this.botAsk = props.botAsk;
    this.isSearchable = props.isSearchable;
    this.isSensitive = props.isSensitive;
    this.sortOrder = props.sortOrder;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewCustomFieldDefinitionInput): CustomFieldDefinition {
    return new CustomFieldDefinition({
      customFieldDefinitionId: newId<CustomFieldDefinitionId>(),
      organizationId: input.organizationId,
      entityType: input.entityType,
      offeringKind: input.offeringKind,
      fieldKey: input.fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      isRequired: input.isRequired,
      options: input.options,
      optionLabels: input.optionLabels,
      validation: input.validation,
      referenceEntity: input.referenceEntity,
      appliesToContactRoles: input.appliesToContactRoles,
      visibility: input.visibility,
      botAsk: input.botAsk,
      isSearchable: input.isSearchable,
      isSensitive: input.isSensitive,
      sortOrder: input.sortOrder,
      status: CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
    });
  }

  static restore(props: CustomFieldDefinitionProps): CustomFieldDefinition {
    return new CustomFieldDefinition(props);
  }

  /** Applies a patch. Existing option keys cannot be removed. Options on a non-select field are refused. */
  withChanges(
    changes: CustomFieldDefinitionChanges,
    now: Date,
    actorUserId: UserId,
  ): CustomFieldDefinition {
    if (this.status !== CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE) throw recordNotFound();
    const options = this.nextOptions(changes.options);
    assertOptionLabelsFit(options, changes.optionLabels);
    return new CustomFieldDefinition(this.patched(changes, options, { now, actorUserId }));
  }

  private patched(
    changes: CustomFieldDefinitionChanges,
    options: readonly string[] | undefined,
    context: { readonly now: Date; readonly actorUserId: UserId },
  ): CustomFieldDefinitionProps {
    return {
      ...this.snapshot(),
      label: changes.label ?? this.label,
      isRequired: changes.isRequired ?? this.isRequired,
      options,
      optionLabels: changes.optionLabels ?? this.optionLabels,
      validation: changes.validation ?? this.validation,
      appliesToContactRoles: this.nextRoles(changes.appliesToContactRoles),
      visibility: changes.visibility ?? this.visibility,
      botAsk: changes.botAsk ?? this.botAsk,
      isSearchable: changes.isSearchable ?? this.isSearchable,
      isSensitive: changes.isSensitive ?? this.isSensitive,
      sortOrder: changes.sortOrder ?? this.sortOrder,
      updatedAt: context.now,
      updatedByUserId: context.actorUserId,
    };
  }

  archive(now: Date, actorUserId: UserId): CustomFieldDefinition {
    if (this.status !== CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE) throw recordNotFound();
    return new CustomFieldDefinition({
      ...this.snapshot(),
      status: CUSTOM_FIELD_DEFINITION_STATUS.ARCHIVED,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  /** Roles belong to contact fields only; null goes back to every role (ADR-113). */
  private nextRoles(
    roles: readonly ContactRole[] | null | undefined,
  ): readonly ContactRole[] | undefined {
    if (roles === undefined) return this.appliesToContactRoles;
    if (roles !== null && this.entityType !== "contact") {
      throw invalidField("appliesToContactRoles", "validation.invalid_value");
    }
    return roles ?? undefined;
  }

  private nextOptions(options: readonly string[] | undefined): readonly string[] | undefined {
    if (options === undefined) return this.options;
    const needsOptions =
      this.fieldType === CUSTOM_FIELD_TYPE.SELECT ||
      this.fieldType === CUSTOM_FIELD_TYPE.MULTI_SELECT;
    if (!needsOptions) throw invalidField("options", "validation.invalid_value");
    const existing = this.options ?? [];
    if (!keepsEveryOption(existing, options)) throw optionsLocked();
    return options;
  }

  private snapshot(): CustomFieldDefinitionProps {
    return {
      customFieldDefinitionId: this.customFieldDefinitionId,
      organizationId: this.organizationId,
      entityType: this.entityType,
      offeringKind: this.offeringKind,
      fieldKey: this.fieldKey,
      label: this.label,
      fieldType: this.fieldType,
      isRequired: this.isRequired,
      options: this.options,
      optionLabels: this.optionLabels,
      validation: this.validation,
      referenceEntity: this.referenceEntity,
      appliesToContactRoles: this.appliesToContactRoles,
      visibility: this.visibility,
      botAsk: this.botAsk,
      isSearchable: this.isSearchable,
      isSensitive: this.isSensitive,
      sortOrder: this.sortOrder,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
    };
  }
}
