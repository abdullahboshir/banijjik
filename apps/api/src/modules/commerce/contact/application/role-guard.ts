import type { ContactRole } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { invalidField } from "../domain/errors.js";
import type { ContactRoleCatalog } from "./ports/settings-and-locations.js";

/** A contact may carry only the roles the organization's template lists (`contactRoleKeys`, ADR-113). */
export async function assertRolesAllowed(
  catalog: ContactRoleCatalog,
  input: { readonly organizationId: OrganizationId; readonly roles: readonly ContactRole[] },
): Promise<void> {
  const allowed = await catalog.allowedRoles(input.organizationId);
  if (input.roles.some((role) => !allowed.includes(role))) {
    throw invalidField("contactRoles", "validation.invalid_value");
  }
}
