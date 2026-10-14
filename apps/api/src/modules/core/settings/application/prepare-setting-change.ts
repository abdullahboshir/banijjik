import type { ModuleKey, SettingChange } from "@banijjik/contracts";
import { buildSettingValueSchema } from "@banijjik/validation";
import type { LocationExistence } from "./ports/location-existence.js";
import {
  invalidSettingValue,
  locationMissing,
  settingNotAvailable,
  settingNotLocationScoped,
  settingsForbidden,
} from "../domain/setting-errors.js";
import type { RegisteredSetting } from "./setting-catalog.js";

export interface PreparedSettingChange {
  readonly settingKey: string;
  readonly locationId: string | null;
  readonly value: unknown;
  readonly version?: number;
}

export interface PrepareSettingChangeInput {
  readonly item: SettingChange;
  readonly index: number;
  readonly catalog: ReadonlyMap<string, RegisteredSetting>;
  readonly effective: ReadonlySet<ModuleKey>;
  readonly reach: readonly string[] | "ALL";
  readonly locations: LocationExistence;
}

/** Every check for one item, before the transaction, so a bad item writes nothing (ADR-103). */
export async function prepareSettingChange(
  input: PrepareSettingChangeInput,
): Promise<PreparedSettingChange> {
  const definition = availableSetting(input);
  const value = parsedValue(input.item, definition, input.index);
  assertLocationScope(input.item, definition);
  assertReach(input.item.locationId, input.reach);
  await assertLocationExists(input.item.locationId, input.locations);
  return {
    settingKey: input.item.settingKey,
    locationId: input.item.locationId ?? null,
    value,
    ...(input.item.version === undefined ? {} : { version: input.item.version }),
  };
}

function availableSetting(input: PrepareSettingChangeInput): RegisteredSetting {
  const definition = input.catalog.get(input.item.settingKey);
  if (definition === undefined || !input.effective.has(definition.moduleKey)) {
    throw settingNotAvailable(input.item.settingKey);
  }
  return definition;
}

/** The stored value is what the spec returned, so a structured schema can drop unknown keys. */
function parsedValue(item: SettingChange, definition: RegisteredSetting, index: number): unknown {
  if (item.value === null) return null;
  const parsed = buildSettingValueSchema(definition.value).safeParse(item.value);
  if (!parsed.success) throw invalidSettingValue(index);
  return parsed.data;
}

function assertLocationScope(item: SettingChange, definition: RegisteredSetting): void {
  if (item.locationId !== undefined && !definition.allowsLocationOverride) {
    throw settingNotLocationScoped(item.settingKey);
  }
}

/** An organization-level write needs every location; a location write needs that one location. */
function assertReach(locationId: string | undefined, reach: readonly string[] | "ALL"): void {
  if (locationId === undefined) {
    if (reach !== "ALL") throw settingsForbidden();
    return;
  }
  if (reach !== "ALL" && !reach.includes(locationId)) throw settingsForbidden();
}

async function assertLocationExists(
  locationId: string | undefined,
  locations: LocationExistence,
): Promise<void> {
  if (locationId === undefined) return;
  if (!(await locations.exists(locationId))) throw locationMissing();
}
