import type { ContactRole } from "@banijjik/contracts";
import type { ContactDedupeMode } from "@banijjik/contracts/contact";
import type { OrganizationId } from "@banijjik/ids";

/** The organization's value of the `contact.dedupeOn` setting. */
export interface DedupeModeReader {
  read(organizationId: OrganizationId): Promise<ContactDedupeMode>;
}

/** Whether a location of the active organization exists and is ACTIVE. Organization owns the Location model. */
export interface HomeLocationLookup {
  isActiveLocation(locationId: string): Promise<boolean>;
}

/** The contact roles the organization's template allows (`contactRoleKeys`, ADR-113). */
export interface ContactRoleCatalog {
  allowedRoles(organizationId: OrganizationId): Promise<readonly ContactRole[]>;
}
