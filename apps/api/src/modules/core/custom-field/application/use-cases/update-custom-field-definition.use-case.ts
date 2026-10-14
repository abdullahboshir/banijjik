import type { CustomFieldDefinitionUpdateRequest, EffectiveCustomField } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { CustomFieldDefinitionId } from "../../domain/custom-field-definition.entity.js";
import { CustomFieldDefinition } from "../../domain/custom-field-definition.entity.js";
import { recordNotFound } from "../../domain/errors.js";
import { definitionAuditFields } from "../custom-field-audit-fields.js";
import { toOrganizationField } from "../effective-custom-field.js";
import type { CustomFieldWriteDependencies } from "../ports/custom-field-write-dependencies.js";
import {
  DEFINITION_AUDIT,
  DEFINITION_ENTITY,
  recordCustomFieldChange,
} from "../record-custom-field-change.js";

export interface UpdateCustomFieldInput {
  readonly customFieldDefinitionId: CustomFieldDefinitionId;
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly version: number;
  readonly changes: Omit<CustomFieldDefinitionUpdateRequest, "version">;
}

/** Edits an organization field. The key and the type stay as they were. A stale version is a 409. */
export class UpdateCustomFieldDefinitionUseCase {
  constructor(private readonly dependencies: CustomFieldWriteDependencies) {}

  execute(input: UpdateCustomFieldInput): Promise<EffectiveCustomField> {
    return this.dependencies.unitOfWork.run(() => this.update(input));
  }

  private async update(input: UpdateCustomFieldInput): Promise<EffectiveCustomField> {
    const existing = await this.requireActive(input.customFieldDefinitionId);
    const edited = existing.withChanges(
      input.changes,
      this.dependencies.clock.now(),
      input.actorUserId,
    );
    const saved = await this.dependencies.definitions.update(
      edited,
      input.version,
      input.actorUserId,
    );
    await this.record(existing, saved, input.organizationId);
    return toOrganizationField(saved);
  }

  private async requireActive(
    customFieldDefinitionId: CustomFieldDefinitionId,
  ): Promise<CustomFieldDefinition> {
    const existing = await this.dependencies.definitions.findById(customFieldDefinitionId);
    if (existing === undefined) throw recordNotFound();
    return existing;
  }

  private async record(
    existing: CustomFieldDefinition,
    saved: CustomFieldDefinition,
    organizationId: string,
  ): Promise<void> {
    await recordCustomFieldChange(this.dependencies, {
      action: DEFINITION_AUDIT.updated,
      entityType: DEFINITION_ENTITY,
      entityId: saved.customFieldDefinitionId,
      before: definitionAuditFields(existing),
      after: definitionAuditFields(saved),
      eventEntityType: saved.entityType,
      fieldKey: saved.fieldKey,
      organizationId,
    });
  }
}
