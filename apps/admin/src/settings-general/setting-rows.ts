import type { SettingsResponse, SettingValueSource, SettingValueSpec } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { sourceLabelOf } from "./setting-labels";
import { isSettingReadOnly, settingToText } from "@banijjik/web-client";

export interface ChoiceOption {
  value: string;
  label: string;
}

/** One setting as the list and its sheet need it; everything is plain data, so it can cross to the client. */
export interface SettingRowView {
  settingKey: string;
  label: string;
  /** Optional longer help from `setting.<key>.description`. */
  description: string | undefined;
  valueText: string;
  source: SettingValueSource;
  sourceLabel: string;
  spec: SettingValueSpec;
  /** The input's starting text. */
  initialText: string;
  /** Choices of a BOOLEAN or ENUM setting; empty for a typed value. */
  options: ChoiceOption[];
  /** The version of the stored row at this level; absent when the value is inherited. */
  version: number | undefined;
  /** Set when the row is the value at one location. */
  locationId: string | undefined;
  canEdit: boolean;
  /** A stored row at this level exists, so it can be removed. */
  canReset: boolean;
}

function descriptionOf(settingKey: string, t: Translator["t"]): string | undefined {
  const key = `setting.${settingKey}.description`;
  const text = t(key);
  return text === key ? undefined : text;
}

export interface SettingRowsInput {
  response: SettingsResponse;
  /** The location the page filters by; absent for the organization level. */
  locationId: string | undefined;
  /** Whether the person may change a setting at this level (permission, mode). */
  canEdit: boolean;
  t: Translator["t"];
}

function optionsOf(settingKey: string, spec: SettingValueSpec, t: Translator["t"]): ChoiceOption[] {
  if (spec.kind === "BOOLEAN") {
    return [
      { value: "true", label: t("customFields.yes") },
      { value: "false", label: t("customFields.no") },
    ];
  }
  if (spec.kind !== "ENUM") return [];
  return spec.values.map((value) => ({ value, label: enumLabel(settingKey, value, t) }));
}

function enumLabel(settingKey: string, value: string, t: Translator["t"]): string {
  const labelKey = `setting.${settingKey}.${value}`;
  return t(labelKey) === labelKey ? value : t(labelKey);
}

function valueTextOf(
  setting: { settingKey: string; spec: SettingValueSpec; value: unknown },
  t: Translator["t"],
): string {
  const { settingKey, spec, value } = setting;
  if (spec.kind === "BOOLEAN") return t(value === true ? "customFields.yes" : "customFields.no");
  if (spec.kind === "ENUM" && typeof value === "string") return enumLabel(settingKey, value, t);
  return settingToText(spec, value);
}

/** Rows in the response's key order. A key the response gives no definition for is left out: there is no input to draw. */
export function toSettingRows(input: SettingRowsInput): SettingRowView[] {
  const { response, locationId, t } = input;
  const scopeSource: SettingValueSource = locationId === undefined ? "ORGANIZATION" : "LOCATION";
  const rows: SettingRowView[] = [];
  for (const [settingKey, resolved] of Object.entries(response.settings)) {
    const definition = response.definitions[settingKey];
    if (definition === undefined) continue;
    if (locationId !== undefined && !definition.allowsLocationOverride) continue;
    const spec = definition.value;
    const hasRowHere = resolved.source === scopeSource;
    rows.push({
      settingKey,
      label: t(`setting.${settingKey}`),
      description: descriptionOf(settingKey, t),
      valueText: valueTextOf({ settingKey, spec, value: resolved.value }, t),
      source: resolved.source,
      sourceLabel: sourceLabelOf(resolved.source, t),
      spec,
      initialText: settingToText(spec, resolved.value),
      options: optionsOf(settingKey, spec, t),
      version: hasRowHere ? resolved.version : undefined,
      locationId,
      canEdit: input.canEdit && !isSettingReadOnly(spec),
      canReset: input.canEdit && hasRowHere,
    });
  }
  return rows;
}
