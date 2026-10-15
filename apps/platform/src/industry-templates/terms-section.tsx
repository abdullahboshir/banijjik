"use client";

import type { IndustryTemplateConfiguration, LocalizedText } from "@banijjik/contracts";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { writeConfiguration } from "./write-configuration";
import type { TemplatePatch } from "./use-template-save";

interface TermRow {
  key: string;
  bn: string;
  en: string;
  isOriginal: boolean;
}

function rowsOf(terms: IndustryTemplateConfiguration["terms"]): TermRow[] {
  return Object.entries(terms).map(([key, text]) => ({
    key,
    bn: text.bn,
    en: text.en,
    isOriginal: true,
  }));
}

function recordOf(rows: readonly TermRow[]): Record<string, LocalizedText> {
  return Object.fromEntries(rows.map((row) => [row.key, { bn: row.bn, en: row.en }]));
}

interface TermsSectionProps {
  configuration: IndustryTemplateConfiguration;
  canWrite: boolean;
  refusesRemoval: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}

export function TermsSection({
  configuration,
  canWrite,
  refusesRemoval,
  labels,
  onSave,
}: TermsSectionProps): ReactElement {
  const t = labelsTranslator(labels);
  const [rows, setRows] = useState<TermRow[]>(() => rowsOf(configuration.terms));
  const [key, setKey] = useState("");
  const [bn, setBn] = useState("");
  const [en, setEn] = useState("");

  function addTerm(): void {
    const termKey = key.trim();
    if (termKey.length === 0 || rows.some((row) => row.key === termKey)) return;
    setRows([...rows, { key: termKey, bn, en, isOriginal: false }]);
    setKey("");
    setBn("");
    setEn("");
  }

  function updateRow(termKey: string, text: Partial<Pick<TermRow, "bn" | "en">>): void {
    setRows(rows.map((row) => (row.key === termKey ? { ...row, ...text } : row)));
  }

  return (
    <IndustrySection title={t("platform.industry.section.terms")}>
      {rows.map((row) => (
        <TermRowFields
          key={row.key}
          row={row}
          canWrite={canWrite}
          canRemove={canWrite && !(refusesRemoval && row.isOriginal)}
          onChange={updateRow}
          onRemove={() => setRows(rows.filter((item) => item.key !== row.key))}
          removeLabel={t("platform.industry.action.remove")}
        />
      ))}
      {canWrite ? (
        <TermActions
          labels={labels}
          keyText={key}
          bn={bn}
          en={en}
          saveLabel={t("platform.industry.action.save")}
          onKey={setKey}
          onBn={setBn}
          onEn={setEn}
          onAdd={addTerm}
          onSave={() =>
            onSave({
              configuration: writeConfiguration({ ...configuration, terms: recordOf(rows) }),
            })
          }
        />
      ) : null}
    </IndustrySection>
  );
}

function TermRowFields(props: {
  row: TermRow;
  canWrite: boolean;
  canRemove: boolean;
  removeLabel: string;
  onChange: (key: string, text: Partial<Pick<TermRow, "bn" | "en">>) => void;
  onRemove: () => void;
}): ReactElement {
  const { row } = props;
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <TextInput id={`term-${row.key}-key`} value={row.key} disabled />
      <TextInput
        id={`term-${row.key}-bn`}
        value={row.bn}
        disabled={!props.canWrite}
        onChange={(event) => props.onChange(row.key, { bn: event.target.value })}
      />
      <TextInput
        id={`term-${row.key}-en`}
        value={row.en}
        disabled={!props.canWrite}
        onChange={(event) => props.onChange(row.key, { en: event.target.value })}
      />
      {props.canRemove ? (
        <Button variant="secondary" onClick={props.onRemove}>
          {props.removeLabel}
        </Button>
      ) : null}
    </div>
  );
}

function TermActions(props: {
  labels: IndustryLabels;
  keyText: string;
  bn: string;
  en: string;
  saveLabel: string;
  onKey: (value: string) => void;
  onBn: (value: string) => void;
  onEn: (value: string) => void;
  onAdd: () => void;
  onSave: () => void;
}): ReactElement {
  return (
    <>
      <NewTermFields
        labels={props.labels}
        keyText={props.keyText}
        bn={props.bn}
        en={props.en}
        onKey={props.onKey}
        onBn={props.onBn}
        onEn={props.onEn}
        onAdd={props.onAdd}
      />
      <Button id="save-terms" onClick={props.onSave}>
        {props.saveLabel}
      </Button>
    </>
  );
}

function NewTermFields(props: {
  labels: IndustryLabels;
  keyText: string;
  bn: string;
  en: string;
  onKey: (value: string) => void;
  onBn: (value: string) => void;
  onEn: (value: string) => void;
  onAdd: () => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FormField label={t("platform.industry.field.termKey")} htmlFor="term-key">
        <TextInput
          id="term-key"
          value={props.keyText}
          onChange={(event) => props.onKey(event.target.value)}
        />
      </FormField>
      <FormField label={t("platform.industry.field.termBn")} htmlFor="term-bn">
        <TextInput
          id="term-bn"
          value={props.bn}
          onChange={(event) => props.onBn(event.target.value)}
        />
      </FormField>
      <FormField label={t("platform.industry.field.termEn")} htmlFor="term-en">
        <TextInput
          id="term-en"
          value={props.en}
          onChange={(event) => props.onEn(event.target.value)}
        />
      </FormField>
      <Button id="add-term" variant="secondary" onClick={props.onAdd}>
        {t("platform.industry.action.addTerm")}
      </Button>
    </div>
  );
}
