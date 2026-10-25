import { EVENT_TYPE, SETTING_VALUE_SOURCE, type ModuleManifest } from "@banijjik/contracts";
import { expect } from "vitest";
import { publishTestEvent } from "../event-fixtures.js";
import { EventHandlerRegistry } from "../../kernel/events/event-handler-registry.js";
import { runEventHandler, type HandlerRunResult } from "../../kernel/events/handler-runner.js";
import { buildModuleEffectiveness } from "../../modules/platform/entitlement/index.js";
import type { ContractWorld } from "./contract-world.js";
import type { ContractCaller, ContractOrganization, ModuleDataAccess } from "./contract-types.js";

/** What the organization sees of a module: the pieces assertions 2 to 5 look at. */
export interface ConfigView {
  readonly modules: readonly string[];
  readonly menuKeys: readonly string[];
  readonly botTools: readonly string[];
  readonly storefrontSections: readonly string[];
  readonly settingKeys: readonly string[];
  readonly fieldEntities: readonly string[];
}

const TENANT_PREFIX = "/orgs/:organizationId";

export async function readConfigView(
  world: ContractWorld,
  organization: ContractOrganization,
): Promise<ConfigView> {
  const { organizationId, owner } = organization;
  const response = await owner.call("get", `/orgs/${organizationId}/me/config`);
  expect(response.status, "GET /me/config answers 200").toBe(200);
  const data = response.body["data"] as {
    modules: string[];
    menu: { menuKey: string }[];
  };
  const resolved = await world.resolvedConfig(organizationId);
  return {
    modules: data.modules,
    menuKeys: data.menu.map((entry) => entry.menuKey),
    botTools: resolved.botTools,
    storefrontSections: resolved.storefrontSections,
    settingKeys: Object.keys(resolved.settings),
    fieldEntities: Object.keys(resolved.fields),
  };
}

/** A `:param` that is not the organization matches any one segment, so a placeholder value reaches the gate. */
export function tenantPaths(manifest: ModuleManifest, organizationId: string): string[] {
  return (manifest.routes.admin ?? [])
    .filter((prefix) => prefix.startsWith(`${TENANT_PREFIX}/`))
    .map((prefix) =>
      prefix.replace(TENANT_PREFIX, `/orgs/${organizationId}`).replace(/:[A-Za-z]+/g, "x"),
    );
}

function errorOf(response: { body: Record<string, unknown> }): {
  code?: string;
  details?: { moduleKey?: string };
} {
  return (response.body["error"] ?? {}) as { code?: string; details?: { moduleKey?: string } };
}

/** Baseline: while the module is on, its routes are not refused for being disabled. */
export async function assertRoutesAreServed(
  organization: ContractOrganization,
  manifest: ModuleManifest,
): Promise<void> {
  for (const path of tenantPaths(manifest, organization.organizationId)) {
    const response = await organization.owner.call("get", path);
    expect(errorOf(response).code, `GET ${path} must not be MODULE_DISABLED`).not.toBe(
      "MODULE_DISABLED",
    );
    expect(response.status, `GET ${path} must be served`).toBeLessThan(500);
  }
}

/** Assertion 1: every tenant route answers 403 MODULE_DISABLED, for a read and for a write. */
export async function assertRoutesAreDisabled(
  caller: ContractCaller,
  input: { organizationId: string; manifest: ModuleManifest },
): Promise<void> {
  const { organizationId, manifest } = input;
  for (const path of tenantPaths(manifest, organizationId)) {
    for (const method of ["get", "post"] as const) {
      const response = await caller.call(method, path, method === "post" ? {} : undefined);
      const label = `${method.toUpperCase()} ${path}`;
      expect(response.status, `${label} answers 403`).toBe(403);
      expect(errorOf(response).code, `${label} answers MODULE_DISABLED`).toBe("MODULE_DISABLED");
      expect(errorOf(response).details?.moduleKey, `${label} names the module`).toBe(manifest.key);
    }
  }
}

/** Baseline: the module shows up where assertions 2 to 5 will later look for it. */
export function assertModuleIsVisible(view: ConfigView, manifest: ModuleManifest): void {
  expect(view.modules, "modules").toContain(manifest.key);
  for (const entry of manifest.menu) expect(view.menuKeys, "menu").toContain(entry.menuKey);
  for (const tool of manifest.botTools) expect(view.botTools, "bot tools").toContain(tool);
  for (const section of manifest.storefrontSections) {
    expect(view.storefrontSections, "storefront sections").toContain(section);
  }
}

function settingsPath(organizationId: string): string {
  return `/orgs/${organizationId}/settings`;
}

function settingsOf(response: {
  body: Record<string, unknown>;
}): Record<string, { value: unknown; source?: string }> {
  const data = response.body["data"] as {
    settings?: Record<string, { value: unknown; source?: string }>;
  };
  return data.settings ?? {};
}

/**
 * While the module is on, each declared setting is listed and a write of its system default succeeds.
 * `/me/config` stays empty until card 2.2, so this is the real settings check (ADR-103).
 */
export async function assertDeclaredSettingsAreServed(
  organization: ContractOrganization,
  manifest: ModuleManifest,
): Promise<void> {
  if (manifest.settings.length === 0) return;
  const path = settingsPath(organization.organizationId);
  const listed = await organization.owner.call("get", path);
  expect(listed.status, "GET /settings").toBe(200);
  for (const setting of manifest.settings) {
    const served = settingsOf(listed)[setting.settingKey];
    // An industry template may start a setting at its own value (12-INDUSTRY-TEMPLATES); only a value that comes from the system must be the declared default.
    if (served?.source === SETTING_VALUE_SOURCE.INDUSTRY) continue;
    expect(served?.value, setting.settingKey).toEqual(setting.systemDefault);
  }
  const [first] = manifest.settings;
  if (first === undefined) return;
  const patched = await organization.owner.call("patch", path, {
    items: [{ settingKey: first.settingKey, value: first.systemDefault }],
  });
  expect(patched.status, "PATCH /settings").toBe(200);
}

/** A module that is off is omitted from GET and refused by PATCH. */
export async function assertDeclaredSettingsAreHidden(
  organization: ContractOrganization,
  manifest: ModuleManifest,
): Promise<void> {
  if (manifest.settings.length === 0) return;
  const path = settingsPath(organization.organizationId);
  const listed = await organization.owner.call("get", path);
  expect(listed.status, "GET /settings while off").toBe(200);
  for (const setting of manifest.settings) {
    expect(settingsOf(listed), setting.settingKey).not.toHaveProperty(setting.settingKey);
  }
  const [first] = manifest.settings;
  if (first === undefined) return;
  const patched = await organization.owner.call("patch", path, {
    items: [{ settingKey: first.settingKey, value: first.systemDefault }],
  });
  expect(patched.status, "PATCH /settings while off").toBe(404);
  expect(patched.body.error.messageKey).toBe("errors.setting_not_available");
}

/** Assertions 2 to 5: the module is gone from the modules, menu, bot tools, sections, settings and fields. */
export function assertModuleIsHidden(view: ConfigView, manifest: ModuleManifest): void {
  expect(view.modules, "modules").not.toContain(manifest.key);
  for (const entry of manifest.menu) expect(view.menuKeys, "menu").not.toContain(entry.menuKey);
  for (const tool of manifest.botTools) expect(view.botTools, "bot tools").not.toContain(tool);
  for (const section of manifest.storefrontSections) {
    expect(view.storefrontSections, "storefront sections").not.toContain(section);
  }
  for (const setting of manifest.settings) {
    expect(view.settingKeys, "settings").not.toContain(setting.settingKey);
  }
  for (const entity of manifest.customFieldEntities) {
    expect(view.fieldEntities, "custom field entities").not.toContain(entity);
  }
}

/** A handler key has no hyphen: `payment-gateway` becomes `paymentGateway`. */
function handlerKeyOf(manifest: ModuleManifest): string {
  const camel = manifest.key.replace(/-(\w)/g, (_match, letter: string) => letter.toUpperCase());
  return `contract.${camel}Probe`;
}

export type HandlerOutcome = HandlerRunResult;

/** Assertion 6 helper: publishes one event for the organization and runs the module's probe handler through the real runner. */
export async function runProbeHandler(
  world: ContractWorld,
  input: { organizationId: string; manifest: ModuleManifest },
): Promise<{ outcome: HandlerOutcome; calls: number }> {
  const { organizationId, manifest } = input;
  let calls = 0;
  const registry = new EventHandlerRegistry();
  const handlerKey = handlerKeyOf(manifest);
  registry.register({
    handlerKey,
    moduleKey: manifest.key,
    eventType: manifest.events.consumes[0] ?? EVENT_TYPE.USER_REGISTERED,
    ordering: "UNORDERED",
    handle: async () => void (calls += 1),
  });
  const event = await publishTestEvent(organizationId);
  const outcome = await runEventHandler(
    { eventId: event.eventId, handlerKey, type: event.type, organizationId },
    registry,
    buildModuleEffectiveness(world.orgConfig),
  );
  return { outcome, calls };
}

export type DocumentCounts = ReadonlyMap<string, number>;

/** Assertion 7 helper: seeds one document per owned model and counts them. */
export async function countModuleData(
  data: ModuleDataAccess,
  input: { organizationId: string; manifest: ModuleManifest },
): Promise<DocumentCounts> {
  const counts = new Map<string, number>();
  for (const modelName of data.modelNames(input.manifest.key)) {
    counts.set(modelName, await data.count(input.organizationId, modelName));
  }
  return counts;
}

export async function seedModuleData(
  data: ModuleDataAccess,
  input: { organizationId: string; manifest: ModuleManifest },
): Promise<void> {
  for (const modelName of data.modelNames(input.manifest.key)) {
    await data.seed(input.organizationId, modelName);
  }
}
