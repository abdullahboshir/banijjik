import type { RoleSummary } from "@banijjik/contracts";
import { banglaTranslator } from "../auth/test-helpers";
import type { AssignmentOptions } from "./assignment-options";

export const OWNER_ROLE_ID = "role-owner";
export const MANAGER_ROLE_ID = "role-manager";
export const STAFF_ROLE_ID = "role-staff";
export const FIRST_LOCATION_ID = "location-1";
export const SECOND_LOCATION_ID = "location-2";

export const { t: translate } = banglaTranslator();

export function role(
  roleId: string,
  roleKey: string,
  overrides: Partial<RoleSummary> = {},
): RoleSummary {
  return {
    roleId,
    roleKey,
    isSystem: true,
    status: "ACTIVE",
    permissionKeys: [],
    memberCount: 0,
    version: 1,
    nameKey: `role.${roleKey.toLowerCase()}`,
    ...overrides,
  };
}

export const ROLES: RoleSummary[] = [
  role(OWNER_ROLE_ID, "OWNER"),
  role(MANAGER_ROLE_ID, "MANAGER"),
  role(STAFF_ROLE_ID, "STAFF"),
];

export const MULTI_LOCATION_OPTIONS: AssignmentOptions = {
  roles: [
    { roleId: MANAGER_ROLE_ID, label: "ম্যানেজার" },
    { roleId: STAFF_ROLE_ID, label: "কর্মী" },
  ],
  locations: [
    { locationId: "ALL", label: "সব শাখা" },
    { locationId: FIRST_LOCATION_ID, label: "মূল শাখা" },
    { locationId: SECOND_LOCATION_ID, label: "দ্বিতীয় শাখা" },
  ],
  isSingleLocation: false,
};

export const SINGLE_LOCATION_OPTIONS: AssignmentOptions = {
  ...MULTI_LOCATION_OPTIONS,
  isSingleLocation: true,
};
