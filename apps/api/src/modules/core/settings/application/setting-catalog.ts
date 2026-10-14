import type { ModuleKey, SettingDefinition } from "@banijjik/contracts";
import type { ModuleManifest } from "@banijjik/contracts";

export interface RegisteredSetting extends SettingDefinition {
  readonly moduleKey: ModuleKey;
}

/** Every setting the running manifests declare. The registry already refused duplicates. */
export function settingCatalogOf(
  manifests: readonly ModuleManifest[],
): ReadonlyMap<string, RegisteredSetting> {
  const catalog = new Map<string, RegisteredSetting>();
  for (const manifest of manifests) {
    for (const setting of manifest.settings) {
      catalog.set(setting.settingKey, { ...setting, moduleKey: manifest.key });
    }
  }
  return catalog;
}
