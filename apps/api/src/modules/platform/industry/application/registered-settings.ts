import type { ModuleKey, PlatformSettingDefinition, SettingDefinition } from "@banijjik/contracts";
import { buildSettingValueSchema } from "@banijjik/validation";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import { industryTemplateSettingInvalid } from "../domain/errors.js";

/** The registered settings a template write checks, and that the platform list returns (ADR-106). */
export interface SettingCatalog {
  list(): readonly PlatformSettingDefinition[];
}

/** Every manifest setting, ordered by key. The industry module reads the kernel registry, not core/settings. */
export function settingCatalogFrom(registry: ModuleRegistry): SettingCatalog {
  const settings = registry
    .all()
    .flatMap((manifest) => manifest.settings.map((setting) => toRegistered(manifest.key, setting)));
  settings.sort((left, right) => left.settingKey.localeCompare(right.settingKey, "en"));
  return { list: () => settings };
}

function toRegistered(moduleKey: ModuleKey, setting: SettingDefinition): PlatformSettingDefinition {
  return {
    settingKey: setting.settingKey,
    moduleKey,
    value: setting.value,
    systemDefault: setting.systemDefault,
    allowsLocationOverride: setting.allowsLocationOverride,
    isClientVisible: setting.isClientVisible,
  };
}

/** Registered keys whose stored default fails the spec. Unregistered keys are skipped (ADR-103, ADR-106). */
export function invalidRegisteredSettingKeys(
  defaults: Readonly<Record<string, unknown>>,
  catalog: SettingCatalog,
): string[] {
  const byKey = new Map(catalog.list().map((setting) => [setting.settingKey, setting]));
  return Object.keys(defaults)
    .filter((settingKey) => failsRegisteredSpec(settingKey, defaults[settingKey], byKey))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function failsRegisteredSpec(
  settingKey: string,
  value: unknown,
  byKey: ReadonlyMap<string, PlatformSettingDefinition>,
): boolean {
  const registered = byKey.get(settingKey);
  if (registered === undefined) return false;
  return !buildSettingValueSchema(registered.value).safeParse(value).success;
}

/** Refuses a create or PATCH whose registered defaults fail their specs. */
export function assertRegisteredSettingDefaults(
  defaults: Readonly<Record<string, unknown>>,
  catalog: SettingCatalog,
): void {
  const invalid = invalidRegisteredSettingKeys(defaults, catalog);
  if (invalid.length > 0) throw industryTemplateSettingInvalid(invalid);
}

/** Defaults whose module is not built yet. Computed on read, never stored. */
export function pendingSettingKeysOf(
  defaults: Readonly<Record<string, unknown>>,
  catalog: SettingCatalog,
): string[] {
  const known = new Set(catalog.list().map((setting) => setting.settingKey));
  return Object.keys(defaults)
    .filter((settingKey) => !known.has(settingKey))
    .sort((left, right) => left.localeCompare(right, "en"));
}
