import {
  SETTING_VALUE_SOURCE,
  type ResolvedSetting,
  type SettingDefinition,
  type SettingValueSource,
} from "@banijjik/contracts";
import { buildSettingValueSchema } from "@banijjik/validation";
import { getLogger } from "../../../../kernel/logger/index.js";
import type { StoredSettingRow } from "./ports/setting-value-repository.js";

export type { StoredSettingRow };

export interface ResolveSettingInput {
  readonly definition: SettingDefinition;
  readonly locationRow: StoredSettingRow | undefined;
  readonly organizationRow: StoredSettingRow | undefined;
  readonly templateDefault: unknown;
  readonly templateVersion: number | undefined;
  readonly locationRequested: boolean;
}

const warnedTemplateDefaults = new Set<string>();

function stored(source: SettingValueSource, row: StoredSettingRow): ResolvedSetting {
  return { value: row.value, source, version: row.version };
}

/** A bad template default is data, not a crash: skip it and warn once per key and template version (ADR-076). */
function warnSkippedDefault(settingKey: string, templateVersion: number): void {
  const mark = `${templateVersion}:${settingKey}`;
  if (warnedTemplateDefaults.has(mark)) return;
  warnedTemplateDefaults.add(mark);
  getLogger().warn({ settingKey, templateVersion }, "settings.template_default_skipped");
}

function templateValue(input: ResolveSettingInput): unknown | undefined {
  if (input.templateDefault === undefined) return undefined;
  const parsed = buildSettingValueSchema(input.definition.value).safeParse(input.templateDefault);
  if (parsed.success) return parsed.data;
  if (input.templateVersion !== undefined) {
    warnSkippedDefault(input.definition.settingKey, input.templateVersion);
  }
  return undefined;
}

/** ADR-016: location, then organization, then a valid template default, then the system default. */
export function resolveSetting(input: ResolveSettingInput): ResolvedSetting {
  const { definition, locationRow, organizationRow, locationRequested } = input;
  if (locationRequested && definition.allowsLocationOverride && locationRow !== undefined) {
    return stored(SETTING_VALUE_SOURCE.LOCATION, locationRow);
  }
  if (organizationRow !== undefined)
    return stored(SETTING_VALUE_SOURCE.ORGANIZATION, organizationRow);
  const fromTemplate = templateValue(input);
  if (fromTemplate !== undefined) {
    return { value: fromTemplate, source: SETTING_VALUE_SOURCE.INDUSTRY };
  }
  return { value: definition.systemDefault, source: SETTING_VALUE_SOURCE.SYSTEM };
}
