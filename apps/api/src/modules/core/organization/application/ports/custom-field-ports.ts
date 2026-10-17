import type { CustomFieldEntityType, EffectiveCustomField } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";

/**
 * The effective custom fields of one entity type for an organization (ADR-102). Routes adapt the
 * custom-field engine to this port, so organization never imports another module.
 */
export interface OrganizationCustomFieldReader {
  forEntity(
    organizationId: OrganizationId,
    entityType: CustomFieldEntityType,
  ): Promise<readonly EffectiveCustomField[]>;
}

/**
 * Who may read sensitive custom field values (ADR-107). Both answers are true only when the caller
 * holds the permission at every location; a caller with a narrower grant gets the redacted view.
 */
export interface SensitiveValueAccess {
  mayReadOrganizationSensitive(): Promise<boolean>;
  mayReadMemberSensitive(): Promise<boolean>;
}
