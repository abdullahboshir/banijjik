import "server-only";
import type { LocationResponse, RoleSummary } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { buildAssignmentOptions, type AssignmentOptions } from "./assignment-options";

const LOOKUP_PAGE_SIZE = 100;

/** Roles and locations of the business, as the staff screens need them to name and to choose. */
export interface StaffLookups {
  /** Every role, archived ones included, so a member's old role still has a name. Empty without permission. */
  roleById: ReadonlyMap<string, RoleSummary>;
  locationNameById: ReadonlyMap<string, string>;
  /** Two or more locations are visible: the staff list shows a locations column. */
  isMultiLocation: boolean;
  /** Absent when the caller may not read roles or locations: editing assignments is then not offered. */
  options: AssignmentOptions | undefined;
}

/**
 * Reads the roles and the active locations once per page. A caller without the permission to read them
 * still sees the page; only the actions that need the choices are left out (the API enforces either way).
 */
export async function loadStaffLookups(
  access: OrgAccess,
  t: Translator["t"],
): Promise<StaffLookups> {
  const base = `/orgs/${access.organization.organizationId}`;
  const [roles, locations] = await Promise.all([
    fetchBusinessResourceIfAllowed<RoleSummary[]>(`${base}/roles?limit=${LOOKUP_PAGE_SIZE}`),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `${base}/locations?status=ACTIVE&limit=${LOOKUP_PAGE_SIZE}`,
    ),
  ]);
  const options =
    roles && locations
      ? buildAssignmentOptions({ roles, locations, permissions: access.config.permissions, t })
      : undefined;
  return {
    roleById: new Map((roles ?? []).map((role) => [role.roleId, role])),
    locationNameById: new Map(
      (locations ?? []).map((location) => [location.locationId, location.name]),
    ),
    isMultiLocation: (locations?.length ?? 0) >= 2,
    options,
  };
}
