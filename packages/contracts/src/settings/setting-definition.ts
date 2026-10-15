import type { ModuleKey } from "../modules/module-key.js";

/**
 * How a module declares one setting (ADR-016, ADR-103). The key is
 * `<moduleKey>.<camelCaseName>` or `<moduleKey>.<group>.<name>` and must start with the module key.
 */
export type SettingValueSpec =
  | { readonly kind: "BOOLEAN" }
  | { readonly kind: "INTEGER"; readonly min: number; readonly max: number }
  | { readonly kind: "MONEY"; readonly min: number; readonly max: number }
  | { readonly kind: "DURATION_MINUTES"; readonly min: number; readonly max: number }
  | { readonly kind: "ENUM"; readonly values: readonly string[] }
  | { readonly kind: "TEXT"; readonly maxLength: number }
  | { readonly kind: "STRUCTURED"; readonly schemaKey: string };

export interface SettingDefinition {
  readonly settingKey: string;
  readonly value: SettingValueSpec;
  /** Must pass `value`. The last step of resolution when nothing else does. */
  readonly systemDefault: unknown;
  readonly allowsLocationOverride: boolean;
  /** Card 2.2 copies these into `/me/config`. The settings API returns every effective key. */
  readonly isClientVisible: boolean;
}

/** One row of `GET /platform/setting-definitions` (ADR-106). A keyed read of the code registry, not a page. */
export interface PlatformSettingDefinition {
  readonly settingKey: string;
  readonly moduleKey: ModuleKey;
  readonly value: SettingValueSpec;
  readonly systemDefault: unknown;
  readonly allowsLocationOverride: boolean;
  readonly isClientVisible: boolean;
}
