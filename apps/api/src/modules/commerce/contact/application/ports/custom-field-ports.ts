import type { EffectiveCustomField } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";

/**
 * The effective custom fields of contacts for an organization (ADR-102). Composition adapts the
 * custom-field engine to this port, so contact never imports another module's internals.
 */
export interface ContactCustomFieldReader {
  forContacts(organizationId: OrganizationId): Promise<readonly EffectiveCustomField[]>;
}

/**
 * Who may read and write sensitive custom field values of contacts (ADR-107): true only when the
 * caller holds `contact.contact.readSensitive` at every location.
 */
export interface SensitiveValueAccess {
  maySeeSensitive(): Promise<boolean>;
}
