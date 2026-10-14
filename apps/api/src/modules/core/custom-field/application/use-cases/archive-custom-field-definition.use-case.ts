import type { EffectiveCustomField } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { CustomFieldDefinitionId } from "../../domain/custom-field-definition.entity.js";
import { recordNotFound } from "../../domain/errors.js";
import { definitionAuditFields } from "../custom-field-audit-fields.js";
import { toOrganizationField } from "../effective-custom-field.js";
import type { CustomFieldWriteDependencies } from "../ports/custom-field-write-dependencies.js";
import {
  DEFINITION_AUDIT,
  DEFINITION_ENTITY,
  recordCustomFieldChange,
} from "../record-custom-field-change.js";

export interface ArchiveCustomFieldInput {
  readonly customFieldDefinitionId: CustomFieldDefinitionId;
  readonly version: number;
  readonly actorUserId: UserId;
  readonly organizationId: string;
}

/** Archives a field. Its stored values stay; the field leaves the effective list (ADR-102). */
export class ArchiveCustomFieldDefinitionUseCase {
  constructor(private readonly dependencies: CustomFieldWriteDependencies) {}

  execute(input: ArchiveCustomFieldInput): Promise<EffectiveCustomField> {
    return this.dependencies.unitOfWork.run(() => this.archive(input));
  }

  private async archive(input: ArchiveCustomFieldInput): Promise<EffectiveCustomField> {
    const existing = await this.dependencies.definitions.findById(input.customFieldDefinitionId);
    if (existing === undefined) throw recordNotFound();
    const archived = existing.archive(this.dependencies.clock.now(), input.actorUserId);
    const saved = await this.dependencies.definitions.update(
      archived,
      input.version,
      input.actorUserId,
    );
    await recordCustomFieldChange(this.dependencies, {
      action: DEFINITION_AUDIT.archived,
      entityType: DEFINITION_ENTITY,
      entityId: saved.customFieldDefinitionId,
      before: definitionAuditFields(existing),
      after: definitionAuditFields(saved),
      eventEntityType: saved.entityType,
      fieldKey: saved.fieldKey,
      organizationId: input.organizationId,
    });
    return toOrganizationField(saved);
  }
}
