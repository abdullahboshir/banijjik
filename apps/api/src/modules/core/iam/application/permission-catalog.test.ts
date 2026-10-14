import { permissionDefinition, PERMISSION_KEY, type PermissionKey } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { auditManifest } from "../../audit/index.js";
import { organizationManifest } from "../../organization/index.js";
import { iamManifest } from "../index.js";
import { buildPermissionCatalog, PermissionCatalogError } from "./permission-catalog.js";

function fakeDefinition(permissionKey: string) {
  // Safe: tests build deliberately wrong keys to prove the catalogue refuses them.
  return permissionDefinition(permissionKey as PermissionKey);
}

describe("buildPermissionCatalog", () => {
  it("collects every key of the iam, organization and audit manifests", () => {
    const catalog = buildPermissionCatalog([iamManifest, organizationManifest, auditManifest]);

    const keys = catalog.all().map((definition) => definition.permissionKey);
    const manifestKeys = [iamManifest, organizationManifest, auditManifest].flatMap((manifest) =>
      manifest.permissions.map((permission) => permission.permissionKey),
    );
    expect(keys.sort()).toEqual(manifestKeys.sort());
    expect(catalog.ofModule("iam")).toHaveLength(4);
    expect(catalog.has("iam.role.read")).toBe(true);
    expect(catalog.has("sales.order.read")).toBe(false);
  });

  it("marks the sensitive keys of 10 section 7", () => {
    const catalog = buildPermissionCatalog([iamManifest, organizationManifest]);

    const sensitive = catalog.all().filter((definition) => definition.isSensitive);

    expect(sensitive.map((definition) => definition.permissionKey).sort()).toEqual([
      PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE,
      PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER,
    ]);
  });

  it("throws for a key that is not in the contracts", () => {
    const manifest = { key: "iam", permissions: [fakeDefinition("iam.role.explode")] };

    expect(() => buildPermissionCatalog([manifest])).toThrow(PermissionCatalogError);
  });

  it("throws for a key that belongs to another module", () => {
    const manifest = { key: "organization", permissions: [fakeDefinition("iam.role.read")] };

    expect(() => buildPermissionCatalog([manifest])).toThrow(/another module/);
  });

  it("throws for a duplicate key", () => {
    const manifests = [
      { key: "iam", permissions: [fakeDefinition("iam.role.read")] },
      { key: "iam", permissions: [fakeDefinition("iam.role.read")] },
    ];

    expect(() => buildPermissionCatalog(manifests)).toThrow(/duplicate/);
  });

  it("throws for a key that breaks the module.entity.action pattern", () => {
    const manifest = { key: "iam", permissions: [fakeDefinition("iam.role")] };

    expect(() => buildPermissionCatalog([manifest])).toThrow(PermissionCatalogError);
  });

  it("changes its hash when the set of keys changes and keeps it otherwise", () => {
    const full = buildPermissionCatalog([iamManifest, organizationManifest]);
    const smaller = buildPermissionCatalog([organizationManifest]);

    expect(full.catalogHash).toMatch(/^[0-9a-f]{64}$/);
    expect(full.catalogHash).not.toBe(smaller.catalogHash);
    expect(full.catalogHash).toBe(
      buildPermissionCatalog([iamManifest, organizationManifest]).catalogHash,
    );
  });
});
