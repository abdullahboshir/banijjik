import type { PermissionDefinitionResponse } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { groupPermissions } from "./permission-groups";

const { t, has } = banglaTranslator();

function definition(permissionKey: string, isSensitive = false): PermissionDefinitionResponse {
  return {
    // Safe: the test keys are real permission keys of the contracts.
    permissionKey: permissionKey as PermissionDefinitionResponse["permissionKey"],
    labelKey: `permission.${permissionKey}`,
    isSensitive,
    moduleKey: permissionKey.split(".")[0] ?? "",
  };
}

const DEFINITIONS = [
  definition("iam.role.read"),
  definition("organization.profile.update"),
  definition("organization.ownership.transfer", true),
];

function groupsFor(mode: "offer" | "show", heldKeys: string[], selectedKeys: string[] = []) {
  return groupPermissions({
    definitions: DEFINITIONS,
    heldKeys: new Set(heldKeys),
    selectedKeys: new Set(selectedKeys),
    mode,
    t,
    hasText: has,
  });
}

describe("groupPermissions", () => {
  it("groups by the module in the first segment of the key", () => {
    const groups = groupsFor(
      "offer",
      DEFINITIONS.map((entry) => entry.permissionKey),
    );

    expect(groups.map((group) => group.moduleKey)).toEqual(["iam", "organization"]);
  });

  it("puts a sensitive permission in the sensitive block, taken from the definition", () => {
    const [, organization] = groupsFor(
      "offer",
      DEFINITIONS.map((entry) => entry.permissionKey),
    );

    expect(organization?.regular.map((item) => item.permissionKey)).toEqual([
      "organization.profile.update",
    ]);
    expect(organization?.sensitive.map((item) => item.permissionKey)).toEqual([
      "organization.ownership.transfer",
    ]);
  });

  it("offers only the permissions the caller holds", () => {
    const groups = groupsFor("offer", ["iam.role.read"]);

    expect(groups.map((group) => group.moduleKey)).toEqual(["iam"]);
  });

  it("keeps a permission the role has but the caller lacks, marked as not held", () => {
    const groups = groupsFor("offer", [], ["organization.ownership.transfer"]);

    const [item] = groups[0]?.sensitive ?? [];
    expect(item).toMatchObject({ isHeld: false, isSelected: true });
  });

  it("shows only the permissions the role has when showing a role", () => {
    const groups = groupsFor(
      "show",
      DEFINITIONS.map((entry) => entry.permissionKey),
      ["iam.role.read"],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.regular[0]?.label).toBe(t("permission.iam.role.read"));
  });

  it("names a group with its module text and falls back to the module key", () => {
    const [iam] = groupsFor("offer", ["iam.role.read"]);

    expect(iam?.label).toBe(t("roles.module.iam"));
  });

  it("falls back to the module key for a module without a name text", () => {
    const [group] = groupPermissions({
      definitions: [{ ...definition("iam.role.read"), moduleKey: "unknown-module" }],
      heldKeys: new Set(["iam.role.read"]),
      selectedKeys: new Set(),
      mode: "offer",
      t,
      hasText: has,
    });

    expect(group?.label).toBe("unknown-module");
  });
});
