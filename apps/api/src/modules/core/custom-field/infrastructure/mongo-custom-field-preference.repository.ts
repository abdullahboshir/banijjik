import type { CustomFieldEntityType, OfferingKind } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { FieldSlot } from "../application/ports/custom-field-ports.js";
import type { CustomFieldPreferenceRepository } from "../application/ports/custom-field-preference-repository.js";
import type { CustomFieldPreference } from "../domain/custom-field-preference.entity.js";
import { versionConflict } from "../domain/errors.js";
import {
  toCustomFieldPreference,
  toCustomFieldPreferenceDocument,
} from "./custom-field-preference.mapper.js";
import {
  CUSTOM_FIELD_PREFERENCE_MODEL_NAME,
  type CustomFieldPreferenceDocument,
} from "./custom-field-preference.schema.js";

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

export class MongoCustomFieldPreferenceRepository implements CustomFieldPreferenceRepository {
  async insert(preference: CustomFieldPreference): Promise<void> {
    try {
      await this.model().create(
        [toCustomFieldPreferenceDocument(preference)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (isDuplicateKeyError(error, "fieldKey")) throw versionConflict(1);
      throw error;
    }
  }

  async findMany(slots: readonly FieldSlot[]): Promise<readonly CustomFieldPreference[]> {
    if (slots.length === 0) return [];
    const documents = await this.model()
      .find({ $or: slots.map(slotFilter) }, null, sessionOption(getActiveSession()))
      .lean<CustomFieldPreferenceDocument[]>();
    return documents.map(toCustomFieldPreference);
  }

  async find(slot: FieldSlot): Promise<CustomFieldPreference | undefined> {
    const document = await this.model()
      .findOne(slotFilter(slot), null, sessionOption(getActiveSession()))
      .lean<CustomFieldPreferenceDocument>();
    return document === null ? undefined : toCustomFieldPreference(document);
  }

  async listFor(
    entityType: CustomFieldEntityType,
    offeringKind: OfferingKind | undefined,
  ): Promise<readonly CustomFieldPreference[]> {
    const documents = await this.model()
      .find(
        { entityType, offeringKind: offeringKind ?? null },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CustomFieldPreferenceDocument[]>();
    return documents.map(toCustomFieldPreference);
  }

  async update(
    preference: CustomFieldPreference,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomFieldPreference> {
    const saved = await updateVersioned<CustomFieldPreferenceDocument>({
      model: this.model(),
      filter: { customFieldPreferenceId: preference.customFieldPreferenceId },
      expectedVersion,
      update: {
        $set: {
          isHidden: preference.isHidden,
          updatedByUserId: actorUserId,
          ...(preference.label === undefined ? {} : { label: preference.label }),
          ...(preference.sortOrder === undefined ? {} : { sortOrder: preference.sortOrder }),
        },
      },
    });
    return toCustomFieldPreference(saved);
  }

  private model() {
    return models({}).get<CustomFieldPreferenceDocument>(CUSTOM_FIELD_PREFERENCE_MODEL_NAME);
  }
}
