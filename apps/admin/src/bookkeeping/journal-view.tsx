"use client";
import { lazy, Suspense, useState, type ReactElement } from "react";
import { Button } from "@banijjik/ui";
import type { JournalEntryResponse } from "@banijjik/contracts/accounting";
import { JOURNAL_SOURCE_LABEL, type BookkeepingLabels } from "./labels";
const JournalDetail = lazy(() => import("./journal-detail"));
export interface JournalViewProps {
  organizationId: string;
  locale: "bn" | "en";
  userId: string;
  entries: readonly JournalEntryResponse[];
  labels: BookkeepingLabels;
  canReverse: boolean;
  today: string;
}
export function JournalView(props: JournalViewProps): ReactElement {
  const [selected, setSelected] = useState<JournalEntryResponse>();
  return (
    <div className="flex flex-col gap-3">
      {props.entries.length === 0 && <p>{props.labels.empty}</p>}
      {props.entries.map((entry) => (
        <article
          key={entry.journalEntryId}
          className="min-w-0 break-words rounded-lg border border-default p-4"
        >
          <h2>
            {entry.entryNumber} · {entry.businessDate}
          </h2>
          <p>{entry.memo ?? props.labels[JOURNAL_SOURCE_LABEL[entry.sourceType]]}</p>
          <Button variant="secondary" onClick={() => setSelected(entry)}>
            {props.labels.detail}
          </Button>
        </article>
      ))}
      {selected !== undefined && (
        <Suspense fallback={null}>
          <JournalDetail {...props} entry={selected} onClose={() => setSelected(undefined)} />
        </Suspense>
      )}
    </div>
  );
}
