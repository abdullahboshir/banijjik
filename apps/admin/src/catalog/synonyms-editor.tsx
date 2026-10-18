"use client";

import { MAX_ORGANIZATION_SYNONYM_TERMS } from "@banijjik/contracts/catalog";
import type { SynonymsResponse } from "@banijjik/contracts/catalog";
import { Button, PageSection } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { TextField } from "./editor-fields";
import type { CategoryLabels } from "./manager-labels";
import { saveSynonyms } from "./record-api";
import { entriesOfRows, rowsOfEntries, type SynonymRow } from "./synonym-entries";
import { useRecordAction } from "./use-record-action";

export interface SynonymsEditorProps {
  organizationId: string;
  synonyms: SynonymsResponse;
  labels: CategoryLabels;
  canUpdate: boolean;
}

function SynonymRowEditor(props: {
  index: number;
  row: SynonymRow;
  labels: CategoryLabels;
  canUpdate: boolean;
  onChange: (patch: Partial<SynonymRow>) => void;
  onRemove: () => void;
}): ReactElement {
  const { index, row, labels, canUpdate } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3">
      <TextField
        id={`synonym-term-${index}`}
        label={labels["synonyms.term"]}
        value={row.term}
        disabled={!canUpdate}
        onChange={(term) => props.onChange({ term })}
      />
      <TextField
        id={`synonym-words-${index}`}
        label={labels["synonyms.words"]}
        value={row.wordsText}
        disabled={!canUpdate}
        onChange={(wordsText) => props.onChange({ wordsText })}
      />
      {canUpdate ? (
        <Button variant="secondary" onClick={props.onRemove}>
          {labels["synonyms.remove"]}
        </Button>
      ) : null}
    </li>
  );
}

/** "Words customers use": a word and the other words that mean the same, behind `catalog.synonym.update`. */
export function SynonymsEditor(props: SynonymsEditorProps): ReactElement {
  const { labels, canUpdate } = props;
  const action = useRecordAction();
  const [rows, setRows] = useState<SynonymRow[]>(() => rowsOfEntries(props.synonyms.entries));
  const [isSaved, setIsSaved] = useState(false);

  function change(index: number, patch: Partial<SynonymRow>): void {
    setIsSaved(false);
    setRows(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  }

  async function save(): Promise<void> {
    const done = await action.run(() =>
      saveSynonyms(props.organizationId, {
        entries: entriesOfRows(rows),
        version: props.synonyms.version,
      }),
    );
    setIsSaved(done);
  }

  return (
    <PageSection title={labels["synonyms.title"]} help={labels["synonyms.help"]}>
      {rows.length === 0 ? (
        <p className="text-small text-secondary">{labels["synonyms.empty"]}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <SynonymRowEditor
            key={index}
            index={index}
            row={row}
            labels={labels}
            canUpdate={canUpdate}
            onChange={(patch) => change(index, patch)}
            onRemove={() => setRows(rows.filter((_row, at) => at !== index))}
          />
        ))}
      </ul>
      {canUpdate ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={rows.length >= MAX_ORGANIZATION_SYNONYM_TERMS}
            onClick={() => setRows([...rows, { term: "", wordsText: "" }])}
          >
            {labels["synonyms.add"]}
          </Button>
          <Button isLoading={action.isBusy} onClick={() => void save()}>
            {labels["synonyms.save"]}
          </Button>
        </div>
      ) : null}
      {isSaved ? (
        <p role="status" className="text-small text-secondary">
          {labels["synonyms.saved"]}
        </p>
      ) : null}
    </PageSection>
  );
}
