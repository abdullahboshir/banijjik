import {
  ALL_LOCATIONS,
  PERMISSION_KEY,
  SYSTEM_ROLE_KEY,
  ROLE_STATUS,
  type CallerPermissionsResponse,
  type LocationResponse,
  type RoleSummary,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { holdsPermissionEverywhere } from "../shell/permissions";

export interface RoleOption {
  roleId: string;
  label: string;
}

export interface LocationOption {
  locationId: string;
  label: string;
}

/** What the assignment rows can choose from. The owner role is never offered (ADR-092). */
export interface AssignmentOptions {
  roles: RoleOption[];
  /** Every location the caller sees, plus "All locations" when the caller may give it. */
  locations: LocationOption[];
  /** One location in the business: the location select is hidden and every row means "ALL". */
  isSingleLocation: boolean;
}

/** System roles carry a catalog key, custom roles a name of their own. */
export function roleLabelOf(
  role: Pick<RoleSummary, "nameKey" | "name">,
  t: Translator["t"],
): string {
  if (role.nameKey !== undefined) return t(role.nameKey);
  return role.name ?? "";
}

export function allLocationsLabel(t: Translator["t"]): string {
  return t("staff.assignment.allLocations");
}

/**
 * A caller who works at every location sees all of them, so one location means a one-location business.
 * A caller limited to some locations may be seeing only part of the business: the select stays.
 */
export function buildAssignmentOptions(input: {
  roles: readonly RoleSummary[];
  locations: readonly LocationResponse[];
  permissions: CallerPermissionsResponse;
  t: Translator["t"];
}): AssignmentOptions {
  const { roles, locations, permissions, t } = input;
  const worksEverywhere = holdsPermissionEverywhere(
    permissions,
    PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE,
  );
  const isSingleLocation = worksEverywhere && locations.length === 1;
  const locationOptions = locations.map((location) => ({
    locationId: location.locationId,
    label: location.name,
  }));
  return {
    roles: roles
      .filter(
        (role) => role.status === ROLE_STATUS.ACTIVE && role.roleKey !== SYSTEM_ROLE_KEY.OWNER,
      )
      .map((role) => ({ roleId: role.roleId, label: roleLabelOf(role, t) })),
    locations: worksEverywhere
      ? [{ locationId: ALL_LOCATIONS, label: allLocationsLabel(t) }, ...locationOptions]
      : locationOptions,
    isSingleLocation,
  };
}
