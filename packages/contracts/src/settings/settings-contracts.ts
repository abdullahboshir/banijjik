import { defineEnum } from "../define-enum.js";

/** Where a resolved value came from (ADR-016). Location is first, system default is last. */
export const SETTING_VALUE_SOURCE = defineEnum(["LOCATION", "ORGANIZATION", "INDUSTRY", "SYSTEM"]);

export type SettingValueSource = (typeof SETTING_VALUE_SOURCE)[keyof typeof SETTING_VALUE_SOURCE];

/** One resolved setting. `version` is present only for a stored organization or location row. */
export interface ResolvedSetting {
  readonly value: unknown;
  readonly source: SettingValueSource;
  readonly version?: number;
}

/** `GET /settings`. A keyed read, bounded by the registry, not a paged list. */
export interface SettingsResponse {
  readonly settings: Readonly<Record<string, ResolvedSetting>>;
}

/** One item of `PATCH /settings`. `value: null` deletes the stored row so resolution falls back. */
export interface SettingChange {
  readonly settingKey: string;
  readonly value: unknown;
  readonly locationId?: string | undefined;
  readonly version?: number | undefined;
}

export interface UpdateSettingsRequest {
  readonly items: readonly SettingChange[];
}

/** Ids only: the keys that this batch changed. Consumers read the values through the settings module. */
export interface SettingChangedPayload {
  readonly settingKeys: readonly string[];
}
