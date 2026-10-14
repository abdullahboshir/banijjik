import type { CustomFieldEntityType, OfferingKind } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { CustomFieldPreference } from "../../domain/custom-field-preference.entity.js";
import type { FieldSlot } from "./custom-field-ports.js";

export interface CustomFieldPreferenceRepository {
  find(slot: FieldSlot): Promise<CustomFieldPreference | undefined>;
  listFor(
    entityType: CustomFieldEntityType,
    offeringKind: OfferingKind | undefined,
  ): Promise<readonly CustomFieldPreference[]>;
  insert(preference: CustomFieldPreference): Promise<void>;
  update(
    preference: CustomFieldPreference,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomFieldPreference>;
}
