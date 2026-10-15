"use client";

import type {
  IndustryTemplateConfiguration,
  PlatformSettingDefinition,
  SettingValueSpec,
} from "@banijjik/contracts";
import { Button, Checkbox, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { writeConfiguration } from "./write-configuration";
import { isSettingReadOnly, parseSettingText } from "./setting-input";
import type { TemplatePatch } from "./use-template-save";

interface SettingRow {
  definition: PlatformSettingDefinition;
  useSystemDefault: boolean;
  text: string;
  checked: boolean;
}

function domId(settingKey: string): string {
  return `setting-${settingKey.replaceAll(".", "-")}`;
}

function textOf(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function rowsOf(
  definitions: readonly PlatformSettingDefinition[],
  defaults: Readonly<Record<string, unknown>>,
): SettingRow[] {
  return definitions
    .filter((definition) => !isSettingReadOnly(definition.value))
    .map((definition) => {
      const stored = defaults[definition.settingKey];
      const useSystemDefault = stored === undefined;
      const value = useSystemDefault ? definition.systemDefault : stored;
      return {
        definition,
        useSystemDefault,
        text: textOf(value),
        checked: value === true,
      };
    });
}

export function SettingsSection({
  configuration,
  definitions,
  canWrite,
  labels,
  onSave,
}: {
  configuration: IndustryTemplateConfiguration;
  definitions: readonly PlatformSettingDefinition[];
  canWrite: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}): ReactElement {
  const [rows, setRows] = useState(() => rowsOf(definitions, configuration.settingsDefaults));
  const [invalid, setInvalid] = useState(false);
  const pending = Object.entries(configuration.settingsDefaults).filter(([settingKey]) =>
    definitions.every((definition) => definition.settingKey !== settingKey),
  );

  function save(): void {
    const settingsDefaults: Record<string, unknown> = Object.fromEntries(pending);
    for (const row of rows) {
      if (row.useSystemDefault) continue;
      const value =
        row.definition.value.kind === "BOOLEAN"
          ? row.checked
          : parseSettingText(row.definition.value, row.text);
      if (value === undefined) {
        setInvalid(true);
        return;
      }
      settingsDefaults[row.definition.settingKey] = value;
    }
    for (const definition of definitions) {
      if (!isSettingReadOnly(definition.value)) continue;
      const stored = configuration.settingsDefaults[definition.settingKey];
      if (stored !== undefined) settingsDefaults[definition.settingKey] = stored;
    }
    setInvalid(false);
    onSave({ configuration: writeConfiguration({ ...configuration, settingsDefaults }) });
  }

  return (
    <SettingList
      rows={rows}
      definitions={definitions}
      pending={pending}
      invalid={invalid}
      canWrite={canWrite}
      labels={labels}
      onRow={(next) =>
        setRows(
          rows.map((item) =>
            item.definition.settingKey === next.definition.settingKey ? next : item,
          ),
        )
      }
      onSave={save}
    />
  );
}

function SettingList(props: {
  rows: readonly SettingRow[];
  definitions: readonly PlatformSettingDefinition[];
  pending: readonly (readonly [string, unknown])[];
  invalid: boolean;
  canWrite: boolean;
  labels: IndustryLabels;
  onRow: (row: SettingRow) => void;
  onSave: () => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  return (
    <IndustrySection title={t("platform.industry.section.settings")}>
      {props.rows.map((row) => (
        <SettingRowFields
          key={row.definition.settingKey}
          row={row}
          canWrite={props.canWrite}
          onChange={props.onRow}
          labels={props.labels}
        />
      ))}
      {props.definitions
        .filter((definition) => isSettingReadOnly(definition.value))
        .map((definition) => (
          <p key={definition.settingKey} className="text-small text-secondary">
            {definition.settingKey} · {t("platform.industry.settings.structured")}
          </p>
        ))}
      {props.pending.length > 0 ? (
        <div>
          <p className="text-small text-secondary">{t("platform.industry.settings.pending")}</p>
          <ul>
            {props.pending.map(([settingKey]) => (
              <li key={settingKey} className="text-small">
                {settingKey}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.invalid ? <p role="alert">{t("validation.invalid_value")}</p> : null}
      {props.canWrite ? (
        <Button id="save-settings" onClick={props.onSave}>
          {t("platform.industry.action.save")}
        </Button>
      ) : null}
    </IndustrySection>
  );
}

function SettingRowFields(props: {
  row: SettingRow;
  canWrite: boolean;
  labels: IndustryLabels;
  onChange: (row: SettingRow) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { row } = props;
  const id = domId(row.definition.settingKey);
  return (
    <div className="flex flex-col gap-2 border-b border-default py-2">
      <p className="text-small font-semibold">{row.definition.settingKey}</p>
      <p className="text-caption text-secondary">
        {t("platform.industry.field.systemDefault")} {textOf(row.definition.systemDefault)}
      </p>
      <Checkbox
        id={`${id}-system`}
        label={t("platform.industry.field.useSystemDefault")}
        checked={row.useSystemDefault}
        disabled={!props.canWrite}
        onChange={(event) => props.onChange({ ...row, useSystemDefault: event.target.checked })}
      />
      {row.useSystemDefault ? null : (
        <SpecInput
          id={id}
          spec={row.definition.value}
          row={row}
          canWrite={props.canWrite}
          onChange={props.onChange}
        />
      )}
    </div>
  );
}

function SpecInput(props: {
  id: string;
  spec: SettingValueSpec;
  row: SettingRow;
  canWrite: boolean;
  onChange: (row: SettingRow) => void;
}): ReactElement | null {
  const { spec, row } = props;
  if (spec.kind === "BOOLEAN") {
    return (
      <Checkbox
        id={props.id}
        label={row.definition.settingKey}
        checked={row.checked}
        disabled={!props.canWrite}
        onChange={(event) => props.onChange({ ...row, checked: event.target.checked })}
      />
    );
  }
  if (spec.kind === "ENUM") {
    return (
      <FormField label={row.definition.settingKey} htmlFor={props.id}>
        <Select
          id={props.id}
          value={row.text}
          disabled={!props.canWrite}
          onChange={(event) => props.onChange({ ...row, text: event.target.value })}
        >
          {spec.values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </FormField>
    );
  }
  if (spec.kind === "STRUCTURED") return null;
  return (
    <FormField label={row.definition.settingKey} htmlFor={props.id}>
      <TextInput
        id={props.id}
        value={row.text}
        disabled={!props.canWrite}
        inputMode={spec.kind === "TEXT" ? "text" : "decimal"}
        onChange={(event) => props.onChange({ ...row, text: event.target.value })}
      />
    </FormField>
  );
}
