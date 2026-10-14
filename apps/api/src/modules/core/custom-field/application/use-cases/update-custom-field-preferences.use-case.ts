import type {
  CustomFieldPreferenceChange,
  IndustryTemplateCustomField,
  OfferingKind,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { CustomFieldPreference } from "../../domain/custom-field-preference.entity.js";
import { recordNotFound, requiredFieldHidden, versionConflict } from "../../domain/errors.js";
import { preferenceAuditFields } from "../custom-field-audit-fields.js";
import type { CustomFieldWriteDependencies } from "../ports/custom-field-write-dependencies.js";
import {
  DEFINITION_AUDIT,
  PREFERENCE_ENTITY,
  recordCustomFieldChange,
} from "../record-custom-field-change.js";

export interface UpdatePreferencesInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly preferences: readonly CustomFieldPreferenceChange[];
}

export interface SavedPreference {
  readonly entityType: CustomFieldPreferenceChange["entityType"];
  readonly fieldKey: string;
  readonly isHidden: boolean;
  readonly version: number;
}

/** Applies a batch of industry-field preferences. One HTTP write is one audit, one event and one bump. */
export class UpdateCustomFieldPreferencesUseCase {
  constructor(private readonly dependencies: CustomFieldWriteDependencies) {}

  execute(input: UpdatePreferencesInput): Promise<readonly SavedPreference[]> {
    return this.dependencies.unitOfWork.run(() => this.update(input));
  }

  private async update(input: UpdatePreferencesInput): Promise<readonly SavedPreference[]> {
    const industryFields = await this.dependencies.industry.forOrganization(input.organizationId);
    const saved: CustomFieldPreference[] = [];
    for (const change of input.preferences) {
      saved.push(await this.saveOne(input, change, industryFields));
    }
    await this.recordBatch(input, saved);
    return saved.map(toSavedPreference);
  }

  private async saveOne(
    input: UpdatePreferencesInput,
    change: CustomFieldPreferenceChange,
    industryFields: readonly IndustryTemplateCustomField[],
  ): Promise<CustomFieldPreference> {
    const field = findIndustryField(industryFields, change);
    if (field === undefined) throw recordNotFound();
    if (change.isHidden === true && field.isRequired) throw requiredFieldHidden();
    const existing = await this.dependencies.preferences.find(change);
    if (existing === undefined) return this.insertPreference(input, change);
    return this.updatePreference(input, change, existing);
  }

  private async insertPreference(
    input: UpdatePreferencesInput,
    change: CustomFieldPreferenceChange,
  ): Promise<CustomFieldPreference> {
    if (change.version !== undefined) throw versionConflict(0);
    const created = CustomFieldPreference.create({
      organizationId: input.organizationId,
      entityType: change.entityType,
      offeringKind: change.offeringKind,
      fieldKey: change.fieldKey,
      isHidden: change.isHidden ?? false,
      label: change.label,
      sortOrder: change.sortOrder,
      createdByUserId: input.actorUserId,
      now: this.dependencies.clock.now(),
    });
    await this.dependencies.preferences.insert(created);
    return created;
  }

  private async updatePreference(
    input: UpdatePreferencesInput,
    change: CustomFieldPreferenceChange,
    existing: CustomFieldPreference,
  ): Promise<CustomFieldPreference> {
    if (change.version === undefined) throw versionConflict(existing.version);
    const edited = existing.withChanges(change, this.dependencies.clock.now(), input.actorUserId);
    return this.dependencies.preferences.update(edited, change.version, input.actorUserId);
  }

  private async recordBatch(
    input: UpdatePreferencesInput,
    saved: readonly CustomFieldPreference[],
  ): Promise<void> {
    const first = saved[0];
    if (first === undefined) return;
    await recordCustomFieldChange(this.dependencies, {
      action: DEFINITION_AUDIT.preference,
      entityType: PREFERENCE_ENTITY,
      entityId: first.customFieldPreferenceId,
      before: {},
      after: preferenceAuditFields(first),
      eventEntityType: first.entityType,
      fieldKey: first.fieldKey,
      organizationId: input.organizationId,
    });
  }
}

function findIndustryField(
  fields: readonly IndustryTemplateCustomField[],
  change: CustomFieldPreferenceChange,
): IndustryTemplateCustomField | undefined {
  return fields.find(
    (field) =>
      field.entityType === change.entityType &&
      sameOffering(field.offeringKind, change.offeringKind) &&
      field.fieldKey === change.fieldKey,
  );
}

function sameOffering(left: OfferingKind | undefined, right: OfferingKind | undefined): boolean {
  return left === right;
}

function toSavedPreference(preference: CustomFieldPreference): SavedPreference {
  return {
    entityType: preference.entityType,
    fieldKey: preference.fieldKey,
    isHidden: preference.isHidden,
    version: preference.version,
  };
}
