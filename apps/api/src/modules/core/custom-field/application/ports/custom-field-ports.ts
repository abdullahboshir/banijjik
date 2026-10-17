import type {
  CustomFieldEntityType,
  EffectiveCustomField,
  IndustryTemplateCustomField,
  OfferingKind,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { CustomFieldDefinition } from "../../domain/custom-field-definition.entity.js";
import type { CustomFieldDefinitionId } from "../../domain/custom-field-definition.entity.js";

export interface FieldSlot {
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind?: OfferingKind | undefined;
  readonly fieldKey: string;
}

export interface CustomFieldDefinitionRepository {
  insert(definition: CustomFieldDefinition): Promise<void>;
  findById(
    customFieldDefinitionId: CustomFieldDefinitionId,
  ): Promise<CustomFieldDefinition | undefined>;
  findByKey(slot: FieldSlot): Promise<CustomFieldDefinition | undefined>;
  listActive(
    entityType: CustomFieldEntityType,
    offeringKind: OfferingKind | undefined,
  ): Promise<readonly CustomFieldDefinition[]>;
  countActive(entityType: CustomFieldEntityType): Promise<number>;
  update(
    definition: CustomFieldDefinition,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomFieldDefinition>;
}

export interface IndustryCustomFields {
  forOrganization(organizationId: OrganizationId): Promise<readonly IndustryTemplateCustomField[]>;
}

export interface CustomFieldAvailability {
  isOffered(entityType: CustomFieldEntityType): Promise<boolean>;
}

export interface EffectiveCustomFieldReader {
  /** What forms, `/me/config` and value checks use: a hidden template field is not in it. */
  forEntity(
    organizationId: OrganizationId,
    entityType: CustomFieldEntityType,
    offeringKind?: OfferingKind,
  ): Promise<readonly EffectiveCustomField[]>;
  /** The management list: also the template fields the business hid, marked `isHidden`, so they can be shown again. */
  forManagement(
    organizationId: OrganizationId,
    entityType: CustomFieldEntityType,
    offeringKind?: OfferingKind,
  ): Promise<readonly EffectiveCustomField[]>;
}
