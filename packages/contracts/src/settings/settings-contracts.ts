import { defineEnum } from "../define-enum.js";
import type { ModuleClass } from "../modules/module-class.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { SettingValueSpec } from "./setting-definition.js";

/** Where a resolved value came from (ADR-016). Location is first, system default is last. */
export const SETTING_VALUE_SOURCE = defineEnum(["LOCATION", "ORGANIZATION", "INDUSTRY", "SYSTEM"]);

export type SettingValueSource = (typeof SETTING_VALUE_SOURCE)[keyof typeof SETTING_VALUE_SOURCE];

/** One resolved setting. `version` is present only for a stored organization or location row. */
export interface ResolvedSetting {
  readonly value: unknown;
  readonly source: SettingValueSource;
  readonly version?: number;
}

/** What a client needs to draw an input for one setting: its value spec and whether a location may override it (ADR-108). */
export interface SettingDescriptor {
  readonly value: SettingValueSpec;
  readonly allowsLocationOverride: boolean;
}

/** `GET /settings`. A keyed read, bounded by the registry, not a paged list. `definitions` has the same keys as `settings`. */
export interface SettingsResponse {
  readonly settings: Readonly<Record<string, ResolvedSetting>>;
  readonly definitions: Readonly<Record<string, SettingDescriptor>>;
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

/** Where one language of a term came from (ADR-104). */
export const TERM_TEXT_SOURCE = defineEnum(["INDUSTRY", "ORGANIZATION"]);

export type TermTextSource = (typeof TERM_TEXT_SOURCE)[keyof typeof TERM_TEXT_SOURCE];

/** One language of a term. `version` is present only for a stored override. */
export interface TermLocaleValue {
  readonly text: string;
  readonly source: TermTextSource;
  readonly version?: number;
}

/** `GET /terms`. One row per allowed key, both languages always present. */
export interface TermView {
  readonly termKey: string;
  readonly bn: TermLocaleValue;
  readonly en: TermLocaleValue;
}

export interface TermsResponse {
  readonly terms: readonly TermView[];
}

/** One item of `PATCH /terms`. `text: null` deletes the override so the template text returns. */
export interface TermChange {
  readonly termKey: string;
  readonly locale: "bn" | "en";
  readonly text: string | null;
  readonly version?: number | undefined;
}

export interface UpdateTermsRequest {
  readonly items: readonly TermChange[];
}

/** Ids only: the keys this batch changed. */
export interface TermChangedPayload {
  readonly termKeys: readonly string[];
}

/** `POST /modules/{moduleKey}/disable` and `…/enable`. */
export interface ModuleSwitchRequest {
  readonly reason: string;
}

/** One CORE or OPTIONAL module the package and the template offer. */
export interface TenantModuleView {
  readonly moduleKey: ModuleKey;
  readonly moduleClass: ModuleClass;
  readonly isEffective: boolean;
  readonly tenantCanDisable: boolean;
  readonly isDisabledByTenant: boolean;
  readonly requiredBy: readonly ModuleKey[];
}

/** Ids only. `isDisabled` is the state after the write. */
export interface ModuleToggledPayload {
  readonly moduleKey: ModuleKey;
  readonly isDisabled: boolean;
}
