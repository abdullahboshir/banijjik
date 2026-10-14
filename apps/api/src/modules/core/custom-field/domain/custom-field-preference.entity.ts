import { newId, type Id, type OrganizationId, type UserId } from "@banijjik/ids";
import type { CustomFieldEntityType, LocalizedText, OfferingKind } from "@banijjik/contracts";

export type CustomFieldPreferenceId = Id<"CustomFieldPreference">;

const INITIAL_VERSION = 1;

export interface CustomFieldPreferenceProps {
  readonly customFieldPreferenceId: CustomFieldPreferenceId;
  readonly organizationId: OrganizationId;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly isHidden: boolean;
  readonly label: LocalizedText | undefined;
  readonly sortOrder: number | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export interface NewCustomFieldPreferenceInput {
  readonly organizationId: OrganizationId;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly isHidden: boolean;
  readonly label?: LocalizedText | undefined;
  readonly sortOrder?: number | undefined;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface CustomFieldPreferenceChanges {
  readonly isHidden?: boolean | undefined;
  readonly label?: LocalizedText | undefined;
  readonly sortOrder?: number | undefined;
}

/** How one organization shows an industry field. The industry definition itself is never copied (ADR-102). */
export class CustomFieldPreference implements CustomFieldPreferenceProps {
  readonly customFieldPreferenceId: CustomFieldPreferenceId;
  readonly organizationId: OrganizationId;
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind: OfferingKind | undefined;
  readonly fieldKey: string;
  readonly isHidden: boolean;
  readonly label: LocalizedText | undefined;
  readonly sortOrder: number | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  private constructor(props: CustomFieldPreferenceProps) {
    this.customFieldPreferenceId = props.customFieldPreferenceId;
    this.organizationId = props.organizationId;
    this.entityType = props.entityType;
    this.offeringKind = props.offeringKind;
    this.fieldKey = props.fieldKey;
    this.isHidden = props.isHidden;
    this.label = props.label;
    this.sortOrder = props.sortOrder;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewCustomFieldPreferenceInput): CustomFieldPreference {
    return new CustomFieldPreference({
      customFieldPreferenceId: newId<CustomFieldPreferenceId>(),
      organizationId: input.organizationId,
      entityType: input.entityType,
      offeringKind: input.offeringKind,
      fieldKey: input.fieldKey,
      isHidden: input.isHidden,
      label: input.label,
      sortOrder: input.sortOrder,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
    });
  }

  static restore(props: CustomFieldPreferenceProps): CustomFieldPreference {
    return new CustomFieldPreference(props);
  }

  withChanges(
    changes: CustomFieldPreferenceChanges,
    now: Date,
    actorUserId: UserId,
  ): CustomFieldPreference {
    return new CustomFieldPreference({
      ...this.snapshot(),
      isHidden: changes.isHidden ?? this.isHidden,
      label: changes.label ?? this.label,
      sortOrder: changes.sortOrder ?? this.sortOrder,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  private snapshot(): CustomFieldPreferenceProps {
    return {
      customFieldPreferenceId: this.customFieldPreferenceId,
      organizationId: this.organizationId,
      entityType: this.entityType,
      offeringKind: this.offeringKind,
      fieldKey: this.fieldKey,
      isHidden: this.isHidden,
      label: this.label,
      sortOrder: this.sortOrder,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
    };
  }
}
