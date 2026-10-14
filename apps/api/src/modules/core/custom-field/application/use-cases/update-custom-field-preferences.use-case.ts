import type {
  CustomFieldPreferenceChange,
  IndustryTemplateCustomField,
  OfferingKind,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { CustomFieldPreference } from "../../domain/custom-field-preference.entity.js";
import type { FieldSlot } from "../ports/custom-field-ports.js";
import { recordNotFound, requiredFieldHidden, versionConflict } from "../../domain/errors.js";
import { preferenceAuditFields } from "../custom-field-audit-fields.js";
import type { AuditFields } from "../../../../../kernel/audit/index.js";
import type { CustomFieldWriteDependencies } from "../ports/custom-field-write-dependencies.js";
import {
  DEFINITION_AUDIT,
  PREFERENCE_ENTITY,
  recordCustomFieldAuditAndEvent,
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

interface SavedPreferenceRow {
  readonly before: AuditFields;
  readonly preference: CustomFieldPreference;
}

interface PreferenceSaveContext {
  readonly industryFields: readonly IndustryTemplateCustomField[];
  readonly existing: ReadonlyMap<string, CustomFieldPreference>;
}

/** Each changed row is one audit entry and one event. The batch bumps configVersion once. */
export class UpdateCustomFieldPreferencesUseCase {
  constructor(private readonly dependencies: CustomFieldWriteDependencies) {}

  execute(input: UpdatePreferencesInput): Promise<readonly SavedPreference[]> {
    return this.dependencies.unitOfWork.run(() => this.update(input));
  }

  private async update(input: UpdatePreferencesInput): Promise<readonly SavedPreference[]> {
    const industryFields = await this.dependencies.industry.forOrganization(input.organizationId);
    const existing = indexBySlot(await this.dependencies.preferences.findMany(input.preferences));
    const saved: SavedPreferenceRow[] = [];
    for (const change of input.preferences) {
      saved.push(await this.saveOne(input, change, { industryFields, existing }));
    }
    await this.recordRows(input, saved);
    await this.dependencies.configVersion.bump(input.organizationId);
    return saved.map((row) => toSavedPreference(row.preference));
  }

  private async saveOne(
    input: UpdatePreferencesInput,
    change: CustomFieldPreferenceChange,
    context: PreferenceSaveContext,
  ): Promise<SavedPreferenceRow> {
    const field = findIndustryField(context.industryFields, change);
    if (field === undefined) throw recordNotFound();
    if (change.isHidden === true && field.isRequired) throw requiredFieldHidden();
    const existing = context.existing.get(slotKey(change));
    if (existing === undefined) {
      return { before: {}, preference: await this.insertPreference(input, change) };
    }
    return {
      before: preferenceAuditFields(existing),
      preference: await this.updatePreference(input, change, existing),
    };
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

  private async recordRows(
    input: UpdatePreferencesInput,
    saved: readonly SavedPreferenceRow[],
  ): Promise<void> {
    for (const row of saved) {
      await recordCustomFieldAuditAndEvent(this.dependencies, {
        action: DEFINITION_AUDIT.preference,
        entityType: PREFERENCE_ENTITY,
        entityId: row.preference.customFieldPreferenceId,
        before: row.before,
        after: preferenceAuditFields(row.preference),
        eventEntityType: row.preference.entityType,
        fieldKey: row.preference.fieldKey,
        organizationId: input.organizationId,
      });
    }
  }
}

function slotKey(slot: FieldSlot): string {
  return `${slot.entityType}\u0000${slot.offeringKind ?? ""}\u0000${slot.fieldKey}`;
}

function indexBySlot(
  preferences: readonly CustomFieldPreference[],
): Map<string, CustomFieldPreference> {
  return new Map(preferences.map((preference) => [slotKey(preference), preference]));
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
