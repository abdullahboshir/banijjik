import { CUSTOM_FIELD_DEFINITION_STATUS } from "@banijjik/contracts";
import type { CustomFieldEntityType, OfferingKind } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  CustomFieldDefinitionRepository,
  FieldSlot,
} from "../application/ports/custom-field-ports.js";
import type { CustomFieldDefinition } from "../domain/custom-field-definition.entity.js";
import type { CustomFieldDefinitionId } from "../domain/custom-field-definition.entity.js";
import { keyTaken } from "../domain/errors.js";
import {
  toCustomFieldDefinition,
  toCustomFieldDefinitionDocument,
} from "./custom-field-definition.mapper.js";
import {
  CUSTOM_FIELD_DEFINITION_MODEL_NAME,
  type CustomFieldDefinitionDocument,
} from "./custom-field-definition.schema.js";

function slotFilter(slot: FieldSlot): {
  entityType: CustomFieldEntityType;
  offeringKind: OfferingKind | null;
  fieldKey: string;
} {
  return {
    entityType: slot.entityType,
    offeringKind: slot.offeringKind ?? null,
    fieldKey: slot.fieldKey,
  };
}

function definitionUpdateSet(
  definition: CustomFieldDefinition,
  actorUserId: UserId,
): Record<string, unknown> {
  const document = toCustomFieldDefinitionDocument(definition);
  const {
    label,
    isRequired,
    visibility,
    botAsk,
    isSearchable,
    isSensitive,
    sortOrder,
    status,
    options,
    optionLabels,
    validation,
    appliesToContactRoles,
    listingTier,
    isFilterable,
    sectionKey,
    minAgeYears,
    mustDifferFromAccountPhone,
  } = document;
  return {
    label,
    isRequired,
    visibility,
    botAsk,
    isSearchable,
    isSensitive,
    sortOrder,
    status,
    updatedByUserId: actorUserId,
    ...(options === undefined ? {} : { options }),
    ...(optionLabels === undefined ? {} : { optionLabels }),
    ...(validation === undefined ? {} : { validation }),
    ...(appliesToContactRoles === undefined ? {} : { appliesToContactRoles }),
    ...(listingTier === undefined ? {} : { listingTier }),
    ...(isFilterable === undefined ? {} : { isFilterable }),
    ...(sectionKey === undefined ? {} : { sectionKey }),
    ...(minAgeYears === undefined ? {} : { minAgeYears }),
    ...(mustDifferFromAccountPhone === undefined ? {} : { mustDifferFromAccountPhone }),
  };
}

/** Organization-made fields. The tenant plugin adds the organization filter (ADR-087). */
export class MongoCustomFieldDefinitionRepository implements CustomFieldDefinitionRepository {
  async insert(definition: CustomFieldDefinition): Promise<void> {
    try {
      await this.model().create(
        [toCustomFieldDefinitionDocument(definition)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (isDuplicateKeyError(error, "fieldKey")) throw keyTaken();
      throw error;
    }
  }

  async findById(
    customFieldDefinitionId: CustomFieldDefinitionId,
  ): Promise<CustomFieldDefinition | undefined> {
    const document = await this.model()
      .findOne({ customFieldDefinitionId }, null, sessionOption(getActiveSession()))
      .lean<CustomFieldDefinitionDocument>();
    return document === null ? undefined : toCustomFieldDefinition(document);
  }

  async findByKey(slot: FieldSlot): Promise<CustomFieldDefinition | undefined> {
    const document = await this.model()
      .findOne(slotFilter(slot), null, sessionOption(getActiveSession()))
      .lean<CustomFieldDefinitionDocument>();
    return document === null ? undefined : toCustomFieldDefinition(document);
  }

  async listActive(
    entityType: CustomFieldEntityType,
    offeringKind: OfferingKind | undefined,
  ): Promise<readonly CustomFieldDefinition[]> {
    const documents = await this.model()
      .find(
        {
          entityType,
          offeringKind: offeringKind ?? null,
          status: CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE,
        },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CustomFieldDefinitionDocument[]>();
    return documents.map(toCustomFieldDefinition);
  }

  countActive(entityType: CustomFieldEntityType): Promise<number> {
    return this.model()
      .countDocuments({ entityType, status: CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE })
      .session(getActiveSession() ?? null)
      .exec();
  }

  async update(
    definition: CustomFieldDefinition,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomFieldDefinition> {
    const saved = await updateVersioned<CustomFieldDefinitionDocument>({
      model: this.model(),
      filter: { customFieldDefinitionId: definition.customFieldDefinitionId },
      expectedVersion,
      update: {
        $set: definitionUpdateSet(definition, actorUserId),
        // Going back to every role removes the list.
        ...(definition.appliesToContactRoles === undefined
          ? { $unset: { appliesToContactRoles: 1 } }
          : {}),
      },
    });
    return toCustomFieldDefinition(saved);
  }

  private model() {
    return models({}).get<CustomFieldDefinitionDocument>(CUSTOM_FIELD_DEFINITION_MODEL_NAME);
  }
}
