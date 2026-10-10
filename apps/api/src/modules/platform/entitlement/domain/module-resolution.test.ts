import {
  MODULE_CLASS,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  OFFERING_KIND,
  type ModuleKey,
  type ModuleManifest,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { aManifest } from "../../../../test-support/manifest-fixtures.js";
import { resolveModules, type ModuleResolutionInput } from "./module-resolution.js";

const ALL_KINDS = Object.values(OFFERING_KIND);

const SYSTEM_IAM = aManifest("iam", { moduleClass: MODULE_CLASS.SYSTEM });
const CORE_CONTACT = aManifest("contact", { moduleClass: MODULE_CLASS.CORE });
const CORE_CATALOG = aManifest("catalog", {
  moduleClass: MODULE_CLASS.CORE,
  providesKinds: [OFFERING_KIND.PRODUCT],
});
const OPTIONAL_WORKFLOW = aManifest("workflow", { tenantCanDisable: true });
const OPTIONAL_POS = aManifest("pos", { tenantCanDisable: false });
const PLATFORM_PACKAGE = aManifest("package", { moduleClass: MODULE_CLASS.PLATFORM });

function input(overrides: Partial<ModuleResolutionInput> = {}): ModuleResolutionInput {
  return {
    manifests: [SYSTEM_IAM, CORE_CONTACT, CORE_CATALOG, OPTIONAL_WORKFLOW, OPTIONAL_POS],
    packageModuleKeys: [],
    overrides: [],
    allowedModuleKeys: Object.values(MODULE_KEY),
    enabledKinds: ALL_KINDS,
    ...overrides,
  };
}

function override(moduleKey: ModuleKey, effect: ModuleOverrideEffect) {
  return { moduleKey, effect, expiresAt: null };
}

function modulesOf(resolutionInput: ModuleResolutionInput): ModuleKey[] {
  return [...resolveModules(resolutionInput).moduleKeys].sort();
}

describe("resolveModules step 1 and 2: purchased modules and candidates", () => {
  it("always includes SYSTEM and CORE modules, and adds what the packages contain", () => {
    expect(modulesOf(input())).toEqual(["catalog", "contact", "iam"]);
    expect(modulesOf(input({ packageModuleKeys: [MODULE_KEY.WORKFLOW] }))).toEqual([
      "catalog",
      "contact",
      "iam",
      "workflow",
    ]);
  });

  it("ignores a package key that has no registered manifest", () => {
    const resolved = modulesOf(input({ packageModuleKeys: [MODULE_KEY.BOT, MODULE_KEY.WEBSITE] }));

    expect(resolved).toEqual(["catalog", "contact", "iam"]);
  });

  it("never puts a PLATFORM module into the config, even when a package or a grant names it", () => {
    const withPlatform = input({
      manifests: [...input().manifests, PLATFORM_PACKAGE],
      packageModuleKeys: [MODULE_KEY.PACKAGE],
      overrides: [override(MODULE_KEY.PACKAGE, MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT)],
    });

    expect(modulesOf(withPlatform)).not.toContain("package");
  });

  it("lets PLATFORM_GRANT enable a module that is outside the package", () => {
    const granted = input({ overrides: [override("pos", MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT)] });

    expect(modulesOf(granted)).toContain("pos");
  });

  it("lets PLATFORM_REVOKE remove a module that is in the package", () => {
    const revoked = input({
      packageModuleKeys: [MODULE_KEY.WORKFLOW],
      overrides: [override("workflow", MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE)],
    });

    expect(modulesOf(revoked)).not.toContain("workflow");
  });

  it.each([
    ["a module the tenant may disable", "workflow", false],
    ["a module the tenant may not disable", "pos", true],
  ] as const)(
    "applies TENANT_DISABLE to %s only when the manifest allows it",
    (_label, key, stays) => {
      const disabled = input({
        packageModuleKeys: [key],
        overrides: [override(key, MODULE_OVERRIDE_EFFECT.TENANT_DISABLE)],
      });

      expect(modulesOf(disabled).includes(key)).toBe(stays);
    },
  );

  it("keeps SYSTEM modules whatever the template allows, and removes excluded CORE and purchased ones", () => {
    const narrowTemplate = input({
      packageModuleKeys: [MODULE_KEY.WORKFLOW],
      allowedModuleKeys: [MODULE_KEY.CONTACT],
    });

    expect(modulesOf(narrowTemplate)).toEqual(["contact", "iam"]);
  });
});

describe("resolveModules step 3 and 4: kinds", () => {
  it("keeps the template kinds that a candidate module provides", () => {
    const resolution = resolveModules(
      input({ enabledKinds: [OFFERING_KIND.PRODUCT, OFFERING_KIND.SERVICE] }),
    );

    expect(resolution.kinds).toEqual([OFFERING_KIND.PRODUCT]);
  });

  it("drops a module that needs a kind the organization does not have", () => {
    const stockManifest = aManifest("inventory", {
      moduleClass: MODULE_CLASS.CORE,
      requiresAnyKind: [OFFERING_KIND.PRODUCT],
    });
    const manifests = [...input().manifests, stockManifest];

    const withProducts = modulesOf(input({ manifests }));
    const salonOnly = modulesOf(input({ manifests, enabledKinds: [OFFERING_KIND.SERVICE] }));

    expect(withProducts).toContain("inventory");
    expect(salonOnly).not.toContain("inventory");
  });

  it("keeps a module whose required kind list has one matching kind", () => {
    const flexible = aManifest("delivery", {
      moduleClass: MODULE_CLASS.CORE,
      requiresAnyKind: [OFFERING_KIND.SERVICE, OFFERING_KIND.PRODUCT],
    });

    expect(modulesOf(input({ manifests: [...input().manifests, flexible] }))).toContain("delivery");
  });
});

describe("resolveModules step 5: dependencies", () => {
  function chain(): ModuleManifest[] {
    return [
      SYSTEM_IAM,
      aManifest("messaging", { dependsOn: [MODULE_KEY.CONTACT] }),
      aManifest("bot", { dependsOn: [MODULE_KEY.MESSAGING] }),
      aManifest("social", { dependsOn: [MODULE_KEY.BOT] }),
      CORE_CONTACT,
    ];
  }

  it("keeps a whole chain when every dependency is effective", () => {
    const resolved = modulesOf(
      input({
        manifests: chain(),
        packageModuleKeys: [MODULE_KEY.MESSAGING, MODULE_KEY.BOT, MODULE_KEY.SOCIAL],
      }),
    );

    expect(resolved).toEqual(["bot", "contact", "iam", "messaging", "social"]);
  });

  it("drops dependants until stable and reports each drop, never enabling the missing module", () => {
    const resolution = resolveModules(
      input({
        manifests: chain(),
        // messaging is not bought, so bot and then social must fall too.
        packageModuleKeys: [MODULE_KEY.BOT, MODULE_KEY.SOCIAL],
      }),
    );

    expect([...resolution.moduleKeys].sort()).toEqual(["contact", "iam"]);
    expect(resolution.droppedForDependency).toEqual(
      expect.arrayContaining([
        { moduleKey: "bot", missingDependency: "messaging" },
        { moduleKey: "social", missingDependency: "bot" },
      ]),
    );
  });

  it("drops a module whose dependency is a kind-dropped module", () => {
    const manifests: ModuleManifest[] = [
      SYSTEM_IAM,
      aManifest("inventory", {
        moduleClass: MODULE_CLASS.CORE,
        requiresAnyKind: [OFFERING_KIND.PRODUCT],
      }),
      aManifest("courier", { moduleClass: MODULE_CLASS.CORE, dependsOn: [MODULE_KEY.INVENTORY] }),
    ];

    const resolved = modulesOf(input({ manifests, enabledKinds: [OFFERING_KIND.SERVICE] }));

    expect(resolved).toEqual(["iam"]);
  });
});
