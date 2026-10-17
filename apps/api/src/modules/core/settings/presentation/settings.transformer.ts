import type { ResolvedSetting, SettingsResponse } from "@banijjik/contracts";
import type { RegisteredSetting } from "../application/setting-catalog.js";

function descriptorsOf(
  resolved: ReadonlyMap<string, ResolvedSetting>,
  catalog: ReadonlyMap<string, RegisteredSetting>,
): SettingsResponse["definitions"] {
  const descriptors: Record<string, SettingsResponse["definitions"][string]> = {};
  for (const settingKey of resolved.keys()) {
    const definition = catalog.get(settingKey);
    if (definition === undefined) continue;
    descriptors[settingKey] = {
      value: definition.value,
      allowsLocationOverride: definition.allowsLocationOverride,
    };
  }
  return descriptors;
}

/** `GET` and `PATCH /settings` share this shape. Keys stay in resolver order. */
export function toSettingsResponse(
  resolved: ReadonlyMap<string, ResolvedSetting>,
  catalog: ReadonlyMap<string, RegisteredSetting>,
): SettingsResponse {
  return { settings: Object.fromEntries(resolved), definitions: descriptorsOf(resolved, catalog) };
}
