import type { ResolvedSetting, SettingsResponse } from "@banijjik/contracts";

/** `GET` and `PATCH /settings` share this shape. Keys stay in resolver order. */
export function toSettingsResponse(
  resolved: ReadonlyMap<string, ResolvedSetting>,
): SettingsResponse {
  return { settings: Object.fromEntries(resolved) };
}
