import { MODULE_CLASS, MODULE_KEY, type ModuleKey, type ModuleManifest } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { defineModule } from "../../../../kernel/modules/index.js";
import { findClosureGaps, findUnbuiltModuleKeys } from "./package-closure.js";

function manifest(
  key: ModuleKey,
  moduleClass: ModuleManifest["moduleClass"],
  dependsOn: readonly ModuleKey[] = [],
): ModuleManifest {
  return defineModule({
    key,
    path: `probe/${key}`,
    moduleClass,
    dependsOn,
    providesKinds: [],
    requiresAnyKind: [],
    tenantCanDisable: false,
    permissions: [],
    routes: {},
    menu: [],
    settings: [],
    customFieldEntities: [],
    botTools: [],
    storefrontSections: [],
    events: { emits: [], consumes: [] },
    limitKeys: [],
    sequenceKeys: [],
  });
}

const SYSTEM_MODULE = manifest(MODULE_KEY.IAM, MODULE_CLASS.SYSTEM);
const CORE_MODULE = manifest(MODULE_KEY.CONTACT, MODULE_CLASS.CORE);
const OPTIONAL_BASE = manifest(MODULE_KEY.INVENTORY, MODULE_CLASS.OPTIONAL);
const NEEDS_BASE = manifest(MODULE_KEY.POS, MODULE_CLASS.OPTIONAL, [
  MODULE_KEY.INVENTORY,
  MODULE_KEY.IAM,
  MODULE_KEY.CONTACT,
]);
const ALL = [SYSTEM_MODULE, CORE_MODULE, OPTIONAL_BASE, NEEDS_BASE];

describe("findClosureGaps", () => {
  it("reports a dependency the package does not contain", () => {
    expect(findClosureGaps([MODULE_KEY.POS], ALL)).toEqual([
      { moduleKey: MODULE_KEY.POS, missingDependency: MODULE_KEY.INVENTORY },
    ]);
  });

  it("counts SYSTEM and CORE modules as provided even when the package omits them", () => {
    expect(findClosureGaps([MODULE_KEY.POS, MODULE_KEY.INVENTORY], ALL)).toEqual([]);
  });

  it("skips a dependency that has no manifest yet and a module that has none", () => {
    const onlyPos = [NEEDS_BASE, SYSTEM_MODULE, CORE_MODULE];

    expect(findClosureGaps([MODULE_KEY.POS, MODULE_KEY.SALES], onlyPos)).toEqual([]);
  });
});

describe("findUnbuiltModuleKeys", () => {
  it("lists the package modules without a registered manifest, in package order", () => {
    expect(findUnbuiltModuleKeys([MODULE_KEY.SALES, MODULE_KEY.POS, MODULE_KEY.AI], ALL)).toEqual([
      MODULE_KEY.SALES,
      MODULE_KEY.AI,
    ]);
  });
});
