"use client";

import { Button, DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import { SourceBadge } from "../settings/source-badge";
import type { TermEditSheetProps } from "./term-edit-sheet";
import type { TermListLabels, TermSheetLabels } from "./term-labels";
import type { TermLanguageView, TermRowView } from "./term-rows";

export interface TermListProps {
  organizationId: string;
  rows: TermRowView[];
  labels: TermListLabels;
  sheetLabels: TermSheetLabels;
}

async function loadSheet(): Promise<ComponentType<TermEditSheetProps>> {
  const sheetModule = await import("./term-edit-sheet");
  return sheetModule.TermEditSheet;
}

function LanguageCell({ language }: { language: TermLanguageView }): ReactElement {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{language.text}</span>
      <SourceBadge
        label={language.sourceLabel}
        tone={language.source === "ORGANIZATION" ? "info" : "neutral"}
      />
    </span>
  );
}

function columnsOf(
  labels: TermListLabels,
  onChange: (row: TermRowView) => void,
): DataListColumn<TermRowView>[] {
  return [
    { columnKey: "term", header: labels.term, isPrimary: true, cell: (row) => row.label },
    {
      columnKey: "bn",
      header: labels.bn,
      isPrimary: true,
      cell: (row) => <LanguageCell language={row.bn} />,
    },
    {
      columnKey: "en",
      header: labels.en,
      isPrimary: true,
      cell: (row) => <LanguageCell language={row.en} />,
    },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) =>
        row.canEdit ? (
          <Button variant="secondary" onClick={() => onChange(row)}>
            {labels.change}
          </Button>
        ) : null,
    },
  ];
}

/** The terms table (cards on a phone). The edit sheet loads on the first tap of "Change". */
export function TermList(props: TermListProps): ReactElement {
  const [open, setOpen] = useState<TermRowView | undefined>();
  const Sheet = useLazyComponent(loadSheet, open !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(props.labels, setOpen)}
        rows={props.rows}
        rowKey={(row) => row.termKey}
        emptyState={<EmptyState message={props.labels.empty} />}
      />
      {Sheet && open ? (
        <Sheet
          organizationId={props.organizationId}
          term={open}
          labels={props.sheetLabels}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}
