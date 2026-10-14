import {
  MODULE_CLASS,
  MODULE_OVERRIDE_EFFECT,
  type ModuleKey,
  type ModuleManifest,
} from "@banijjik/contracts";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ModuleRegistry } from "../../kernel/modules/index.js";
import type { IamApiHarness } from "../iam-api-harness.js";
import { ApiActor } from "../two-organizations.js";
import {
  assertDeclaredSettingsAreHidden,
  assertDeclaredSettingsAreServed,
  assertModuleIsHidden,
  assertModuleIsVisible,
  assertRoutesAreDisabled,
  assertRoutesAreServed,
  countModuleData,
  readConfigView,
  runProbeHandler,
  seedModuleData,
  tenantPaths,
} from "./assertions.js";
import type { ContractTemplateReader } from "./contract-template-reader.js";
import type { ModuleDataAccess } from "./contract-types.js";
import { ContractWorld } from "./contract-world.js";
import { applicableOffPaths, type OffPath } from "./off-paths.js";
import { buildUngatedApp } from "./ungated-app.js";

export interface ModuleContractOptions {
  /** Every manifest of the application plus the probe modules. */
  readonly registry: ModuleRegistry;
  /** The keys of the real modules, so the report can tell them from the probes. */
  readonly productionKeys: ReadonlySet<ModuleKey>;
  /** A function, because the harness starts in `beforeAll`, after the tests are declared. */
  readonly harness: () => IamApiHarness;
  readonly templateReader: ContractTemplateReader;
  readonly moduleData: ModuleDataAccess;
  readonly organizationFields: object;
}

/** SYSTEM modules are always on and PLATFORM modules never reach an organization, so only these two classes have off-paths. */
export function modulesNeedingOffPathTests(registry: ModuleRegistry): readonly ModuleManifest[] {
  return registry
    .all()
    .filter(
      (manifest) =>
        manifest.moduleClass === MODULE_CLASS.CORE ||
        manifest.moduleClass === MODULE_CLASS.OPTIONAL,
    );
}

interface Scenario {
  readonly world: ContractWorld;
  readonly data: ModuleDataAccess;
  readonly manifest: ModuleManifest;
  readonly offPath: OffPath;
}

/** Baseline first (the module is on and everything shows it), then one off-path and the seven assertions of section 11. */
async function runScenario(scenario: Scenario): Promise<void> {
  const { world, data, manifest, offPath } = scenario;
  const organization = await world.createOrganization();
  const { organizationId } = organization;
  const subject = { organizationId, manifest };

  assertModuleIsVisible(await readConfigView(world, organization), manifest);
  await assertRoutesAreServed(organization, manifest);
  expect(await runProbeHandler(world, subject), "baseline handler").toEqual({
    outcome: "HANDLED",
    calls: 1,
  });
  await seedModuleData(data, subject);
  const dataBefore = await countModuleData(data, subject);
  await assertDeclaredSettingsAreServed(organization, manifest);

  await offPath.apply({ world, organization, manifest });

  await assertRoutesAreDisabled(organization.owner, subject);
  assertModuleIsHidden(await readConfigView(world, organization), manifest);
  await assertDeclaredSettingsAreHidden(organization, manifest);
  expect(await runProbeHandler(world, subject), "handler of a module that is off").toEqual({
    outcome: "SKIPPED_MODULE_OFF",
    calls: 0,
  });
  expect(await countModuleData(data, subject), "the module's data").toEqual(dataBefore);
}

function describeOneModule(
  manifest: ModuleManifest,
  getWorld: () => ContractWorld,
  options: ModuleContractOptions,
): void {
  const origin = options.productionKeys.has(manifest.key) ? "production" : "probe";
  const offPaths = applicableOffPaths(manifest, options.registry);
  describe(`${manifest.key} (${manifest.moduleClass}, ${origin})`, () => {
    it("has at least one way to be turned off", () => {
      expect(offPaths.length).toBeGreaterThan(0);
    });
    it.each(offPaths.map((offPath) => ({ offPath, name: offPath.name })))(
      "turned off by $name: routes, menu, bot tools, sections, settings, handlers and data",
      async ({ offPath }) => {
        await runScenario({ world: getWorld(), data: options.moduleData, manifest, offPath });
      },
    );
  });
}

/**
 * A module that is off but still answers must fail the route assertion. The probe routes are
 * mounted again without the gate; the assertion has to throw, or the suite could not fail.
 */
function describeSuiteCanFail(getWorld: () => ContractWorld, options: ModuleContractOptions): void {
  it("fails when a route of a module that is off is mounted without the gate", async () => {
    const world = getWorld();
    const probe = modulesNeedingOffPathTests(options.registry).find(
      (manifest) =>
        !options.productionKeys.has(manifest.key) && manifest.moduleClass === MODULE_CLASS.OPTIONAL,
    );
    if (probe === undefined) throw new Error("the negative test needs an OPTIONAL probe module");
    const organization = await world.createOrganization();
    await world.override(
      organization.organizationId,
      probe.key,
      MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    );
    const ungated = new ApiActor(buildUngatedApp(world.harness), organization.owner.person);

    const subject = { organizationId: organization.organizationId, manifest: probe };
    // The ungated route must really answer, or the failure below could come from anything.
    const [probePath = ""] = tenantPaths(probe, subject.organizationId);
    expect((await ungated.call("get", probePath)).status).toBe(200);

    await expect(assertRoutesAreDisabled(ungated, subject)).rejects.toThrow(/answers 403/);
  });
}

/** Says which production modules the suite covered, so a green run never hides "nothing was checked". */
function describeProductionCoverage(options: ModuleContractOptions): void {
  const covered = modulesNeedingOffPathTests(options.registry)
    .filter((manifest) => options.productionKeys.has(manifest.key))
    .map((manifest) => manifest.key);
  const summary =
    covered.length === 0
      ? "none: every production module is SYSTEM or PLATFORM, so none has an off-path"
      : covered.join(", ");
  describe("production modules", () => {
    it(`covered by the off-path tests (${covered.length}): ${summary}`, () => {
      const needing = [...options.productionKeys].filter((key) => {
        const moduleClass = options.registry.find(key)?.moduleClass;
        return moduleClass === MODULE_CLASS.CORE || moduleClass === MODULE_CLASS.OPTIONAL;
      });
      expect([...covered].sort()).toEqual([...needing].sort());
    });
  });
}

/**
 * The generated module contract tests of 10-MODULE-CATALOG section 11. For every CORE and OPTIONAL
 * module in the registry, with no per-module code, each applicable off-path is applied and the
 * seven assertions run. A module added to the manifest list is covered at once.
 */
export function describeModuleContracts(options: ModuleContractOptions): void {
  let world: ContractWorld | undefined;
  const getWorld = (): ContractWorld => {
    if (world === undefined) throw new Error("the contract world starts in beforeAll");
    return world;
  };
  beforeAll(() => {
    world = new ContractWorld({
      harness: options.harness(),
      registry: options.registry,
      templateReader: options.templateReader,
      organizationFields: options.organizationFields,
    });
  });
  afterEach(() => options.templateReader.reset());

  describe("generated module contracts", () => {
    describeProductionCoverage(options);
    for (const manifest of modulesNeedingOffPathTests(options.registry)) {
      describeOneModule(manifest, getWorld, options);
    }
    describeSuiteCanFail(getWorld, options);
  });
}
