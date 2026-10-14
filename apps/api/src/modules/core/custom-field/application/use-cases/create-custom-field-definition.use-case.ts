import type { CustomFieldDefinitionCreateRequest, EffectiveCustomField } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { MAX_ACTIVE_ORGANIZATION_FIELDS } from "../../domain/limits.js";
import { CustomFieldDefinition } from "../../domain/custom-field-definition.entity.js";
import { fieldLimitReached, keyTaken, recordNotFound } from "../../domain/errors.js";
import { definitionAuditFields } from "../custom-field-audit-fields.js";
import { toOrganizationField } from "../effective-custom-field.js";
import type { CustomFieldWriteDependencies } from "../ports/custom-field-write-dependencies.js";
import {
  DEFINITION_AUDIT,
  DEFINITION_ENTITY,
  recordCustomFieldChange,
} from "../record-custom-field-change.js";

export interface CreateCustomFieldInput extends CustomFieldDefinitionCreateRequest {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

/** Adds an organization field. A key already used by the template or this organization is a 409. */
export class CreateCustomFieldDefinitionUseCase {
  constructor(private readonly dependencies: CustomFieldWriteDependencies) {}

  execute(input: CreateCustomFieldInput): Promise<EffectiveCustomField> {
    return this.dependencies.unitOfWork.run(() => this.create(input));
  }

  private async create(input: CreateCustomFieldInput): Promise<EffectiveCustomField> {
    if (!(await this.dependencies.availability.isOffered(input.entityType))) throw recordNotFound();
    await this.assertKeyIsFree(input);
    await this.assertUnderLimit(input);
    const definition = CustomFieldDefinition.create({
      ...input,
      now: this.dependencies.clock.now(),
      createdByUserId: input.actorUserId,
    });
    await this.dependencies.definitions.insert(definition);
    await recordCustomFieldChange(this.dependencies, {
      action: DEFINITION_AUDIT.created,
      entityType: DEFINITION_ENTITY,
      entityId: definition.customFieldDefinitionId,
      before: {},
      after: definitionAuditFields(definition),
      eventEntityType: definition.entityType,
      fieldKey: definition.fieldKey,
      organizationId: input.organizationId,
    });
    return toOrganizationField(definition);
  }

  private async assertKeyIsFree(input: CreateCustomFieldInput): Promise<void> {
    const industryFields = await this.dependencies.industry.forOrganization(input.organizationId);
    const takenByTemplate = industryFields.some(
      (field) =>
        field.entityType === input.entityType &&
        (field.offeringKind ?? undefined) === input.offeringKind &&
        field.fieldKey === input.fieldKey,
    );
    if (takenByTemplate) throw keyTaken();
    const existing = await this.dependencies.definitions.findByKey(input);
    if (existing !== undefined) throw keyTaken();
  }

  private async assertUnderLimit(input: CreateCustomFieldInput): Promise<void> {
    const active = await this.dependencies.definitions.countActive(input.entityType);
    if (active >= MAX_ACTIVE_ORGANIZATION_FIELDS) throw fieldLimitReached();
  }
}
