import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
  SURFACE,
  type ModuleManifest,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { defineModule } from "./define-module.js";
import { ManifestError } from "./manifest-error.js";
import { aManifest } from "../../test-support/manifest-fixtures.js";
import { createModuleRegistry } from "./module-registry.js";

function registryOf(...manifests: ModuleManifest[]) {
  return createModuleRegistry(manifests.map(defineModule));
}

const BROKEN_PERMISSION = {
  // Safe: the test builds a key that is not in the catalogue to prove the registry refuses it.
  permissionKey: "workflow.run.fly" as never,
  labelKey: "permission.workflow.run.fly",
  isSensitive: false,
  surface: SURFACE.ADMIN,
};

const TENANT_MENU_ENTRY = {
  menuKey: "package.list",
  surface: SURFACE.ADMIN,
  groupKey: "settings",
  labelTermKey: "menu.package.list",
  path: "/packages",
  iconKey: "package",
  permissionKey: PERMISSION_KEY.IAM_ROLE_READ,
  order: 1,
};

describe("createModuleRegistry", () => {
  it.each([
    [
      "a duplicate module key",
      () => [aManifest("workflow"), aManifest("workflow")],
      /duplicate module key/,
    ],
    [
      "a dependency cycle",
      () => [
        aManifest("website", { dependsOn: [MODULE_KEY.SOCIAL] }),
        aManifest("social", { dependsOn: [MODULE_KEY.WEBSITE] }),
      ],
      /cycle/,
    ],
    [
      "a permission that belongs to another module",
      () => [
        aManifest("workflow", {
          permissions: [permissionDefinition(PERMISSION_KEY.IAM_ROLE_READ)],
        }),
      ],
      /belongs to another module/,
    ],
    [
      "a permission key that is not in the catalogue",
      () => [aManifest("workflow", { permissions: [BROKEN_PERMISSION] })],
      /unknown permission key/,
    ],
    [
      "a PLATFORM module with a tenant route",
      () => [
        aManifest("package", {
          moduleClass: MODULE_CLASS.PLATFORM,
          routes: { admin: ["/orgs/:organizationId/packages"] },
        }),
      ],
      /PLATFORM module declares platform routes/,
    ],
    [
      "a PLATFORM module with a tenant menu entry",
      () => [
        aManifest("package", { moduleClass: MODULE_CLASS.PLATFORM, menu: [TENANT_MENU_ENTRY] }),
      ],
      /PLATFORM module declares platform routes/,
    ],
    [
      "tenantCanDisable on a module that is not OPTIONAL",
      () => [aManifest("contact", { moduleClass: MODULE_CLASS.CORE, tenantCanDisable: true })],
      /OPTIONAL modules only/,
    ],
    [
      "a duplicate setting key",
      () => [
        aManifest("workflow", {
          settings: [
            {
              settingKey: "workflow.flag",
              value: { kind: "BOOLEAN" },
              systemDefault: false,
              allowsLocationOverride: false,
              isClientVisible: false,
            },
          ],
        }),
        aManifest("website", {
          settings: [
            {
              settingKey: "workflow.flag",
              value: { kind: "BOOLEAN" },
              systemDefault: false,
              allowsLocationOverride: false,
              isClientVisible: false,
            },
          ],
        }),
      ],
      /duplicate setting key/,
    ],
    [
      "a setting key that does not start with the module key",
      () => [
        aManifest("workflow", {
          settings: [
            {
              settingKey: "website.flag",
              value: { kind: "BOOLEAN" },
              systemDefault: false,
              allowsLocationOverride: false,
              isClientVisible: false,
            },
          ],
        }),
      ],
      /does not start with the module key/,
    ],
    [
      "a system default that fails its spec",
      () => [
        aManifest("workflow", {
          settings: [
            {
              settingKey: "workflow.flag",
              value: { kind: "BOOLEAN" },
              systemDefault: "no",
              allowsLocationOverride: false,
              isClientVisible: false,
            },
          ],
        }),
      ],
      /systemDefault of workflow.flag fails its spec/,
    ],
    [
      "an unknown structured setting schema",
      () => [
        aManifest("workflow", {
          settings: [
            {
              settingKey: "workflow.layout",
              value: { kind: "STRUCTURED", schemaKey: "missing.thing" },
              systemDefault: {},
              allowsLocationOverride: false,
              isClientVisible: false,
            },
          ],
        }),
      ],
      /unknown setting schema missing.thing/,
    ],
    [
      "two modules with the same route prefix",
      () => [
        aManifest("workflow", { routes: { admin: ["/orgs/:organizationId/flows"] } }),
        aManifest("website", { routes: { admin: ["/orgs/:id/flows"] } }),
      ],
      /declared by/,
    ],
  ])("throws at startup for %s", (_label, build, message) => {
    expect(() => registryOf(...build())).toThrow(ManifestError);
    expect(() => registryOf(...build())).toThrow(message);
  });

  it("accepts a dependency on a module that is not registered yet", () => {
    const registry = registryOf(aManifest("bot", { dependsOn: [MODULE_KEY.MESSAGING] }));

    expect(registry.find(MODULE_KEY.BOT)).toBeDefined();
    expect(registry.find(MODULE_KEY.MESSAGING)).toBeUndefined();
  });

  it("keeps a registryHash that ignores key order and changes with any manifest change", () => {
    const base = aManifest("workflow");
    // Safe: the same fields in reverse order; the test proves the hash does not depend on it.
    const keysReversed = Object.fromEntries(Object.entries(base).reverse()) as never;
    const changed = aManifest("workflow", { botTools: ["run_flow"] });

    const hash = registryOf(base).registryHash;

    expect(registryOf(keysReversed).registryHash).toBe(hash);
    expect(registryOf(changed).registryHash).not.toBe(hash);
    expect(registryOf(base, aManifest("website")).registryHash).not.toBe(hash);
  });

  it("gives the same hash whatever the registration order", () => {
    const first = registryOf(aManifest("workflow"), aManifest("website"));
    const second = registryOf(aManifest("website"), aManifest("workflow"));

    expect(first.registryHash).toBe(second.registryHash);
  });

  it("lists manifests sorted by key", () => {
    const registry = registryOf(aManifest("workflow"), aManifest("website"));

    expect(registry.all().map((manifest) => manifest.key)).toEqual(["website", "workflow"]);
  });
});

describe("ModuleRegistry.ownerOfRoute", () => {
  const registry = registryOf(
    aManifest("iam", {
      moduleClass: MODULE_CLASS.SYSTEM,
      routes: { admin: ["/me", "/orgs/:organizationId/roles"] },
    }),
    aManifest("organization", {
      moduleClass: MODULE_CLASS.SYSTEM,
      routes: { admin: ["/me/orgs"] },
    }),
    aManifest("website", { routes: { admin: ["/orgs/:organizationId/site"] } }),
  );

  it("picks the longest matching prefix", () => {
    expect(registry.ownerOfRoute("/me/orgs")?.key).toBe("organization");
    expect(registry.ownerOfRoute("/me/orgs/")?.key).toBe("organization");
    expect(registry.ownerOfRoute("/me")?.key).toBe("iam");
    expect(registry.ownerOfRoute("/me/profile")?.key).toBe("iam");
  });

  it("matches a parameter segment against any value and sub-paths against the prefix", () => {
    expect(registry.ownerOfRoute("/orgs/0192-abc/roles")?.key).toBe("iam");
    expect(registry.ownerOfRoute("/orgs/0192-abc/roles/7/archive")?.key).toBe("iam");
    expect(registry.ownerOfRoute("/orgs/0192-abc/site")?.key).toBe("website");
  });

  it("matches whole segments only and returns undefined for a path nobody owns", () => {
    expect(registry.ownerOfRoute("/orgs/0192-abc/rolesX")).toBeUndefined();
    expect(registry.ownerOfRoute("/orgs/0192-abc/unknown")).toBeUndefined();
    expect(registry.ownerOfRoute("/meeting")).toBeUndefined();
  });
});
