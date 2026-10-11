import { PERMISSION_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { allDefinitions } from "../settings/test-fixtures";
import { preservedPermissionKeys, roleActionsFor } from "./role-view";

const ALL_ROLE_KEYS = {
  allLocations: [PERMISSION_KEY.IAM_ROLE_UPDATE, PERMISSION_KEY.IAM_ROLE_ARCHIVE],
  byLocation: {},
};

describe("roleActionsFor", () => {
  it("offers edit and archive for an active custom role with both permissions", () => {
    const actions = roleActionsFor({
      role: { isSystem: false, status: "ACTIVE" },
      permissions: ALL_ROLE_KEYS,
      canWrite: true,
    });

    expect(actions).toEqual(["edit", "archive"]);
  });

  it("offers nothing for a system role", () => {
    const actions = roleActionsFor({
      role: { isSystem: true, status: "ACTIVE" },
      permissions: ALL_ROLE_KEYS,
      canWrite: true,
    });

    expect(actions).toEqual([]);
  });

  it("offers nothing for an archived role", () => {
    const actions = roleActionsFor({
      role: { isSystem: false, status: "ARCHIVED" },
      permissions: ALL_ROLE_KEYS,
      canWrite: true,
    });

    expect(actions).toEqual([]);
  });

  it("offers only the action the caller holds the permission for", () => {
    const actions = roleActionsFor({
      role: { isSystem: false, status: "ACTIVE" },
      permissions: { allLocations: [PERMISSION_KEY.IAM_ROLE_UPDATE], byLocation: {} },
      canWrite: true,
    });

    expect(actions).toEqual(["edit"]);
  });
});

describe("preservedPermissionKeys", () => {
  it("returns the keys no effective module offers", () => {
    const withoutAudit = allDefinitions().filter((definition) => definition.moduleKey !== "audit");

    const preserved = preservedPermissionKeys(
      { permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.AUDIT_LOG_READ] },
      withoutAudit,
    );

    expect(preserved).toEqual([PERMISSION_KEY.AUDIT_LOG_READ]);
  });
});
