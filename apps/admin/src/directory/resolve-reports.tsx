"use client";

import { DIRECTORY_SAFETY_RULES, type ListingReportOutcome } from "@banijjik/contracts/directory";
import { Button, FormField, Sheet, SheetContent, StickyActionBar, Textarea } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { resolveOutcomeOptions } from "./report-resolve-state";
import { useResolveReports } from "./use-resolve-reports";

export interface ResolveReportsLabels {
  open: string;
  title: string;
  outcome: string;
  note: string;
  submit: string;
  cancel: string;
  close: string;
  stale: string;
  failure: string;
  /** Text per outcome key, already phrased with the template's `listing` term. */
  outcomes: Readonly<Record<ListingReportOutcome, string>>;
}

export interface ResolveReportsProps {
  organizationId: string;
  listingId: string;
  /** Exactly the ids on screen: a report filed later stays open (M.7 decision 5). */
  reportIds: readonly string[];
  canHide: boolean;
  canBlockAccounts: boolean;
  queueHref: string;
  labels: ResolveReportsLabels;
}

function OutcomeChoices(props: {
  options: readonly ListingReportOutcome[];
  selected: ListingReportOutcome;
  busy: boolean;
  labels: ResolveReportsLabels;
  onSelect: (outcome: ListingReportOutcome) => void;
}): ReactElement {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small text-secondary">{props.labels.outcome}</legend>
      {props.options.map((outcome) => (
        <label
          key={outcome}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-default px-3"
        >
          <input
            type="radio"
            name="report-outcome"
            value={outcome}
            checked={props.selected === outcome}
            disabled={props.busy}
            onChange={() => props.onSelect(outcome)}
            className="size-5"
          />
          <span className="text-body text-primary">{props.labels.outcomes[outcome]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ResolveNoteField(props: {
  note: string;
  busy: boolean;
  label: string;
  onChange: (note: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor="directory-resolve-note">
      <Textarea
        id="directory-resolve-note"
        value={props.note}
        maxLength={DIRECTORY_SAFETY_RULES.resolutionNoteMaxLength}
        disabled={props.busy}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

/** Resolve sheet: closes the reports on screen with one outcome (M.7 decision 12). */
export function ResolveReports(props: ResolveReportsProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<ListingReportOutcome>("DISMISSED");
  const [note, setNote] = useState("");
  const { labels } = props;
  const { busy, failed, submit } = useResolveReports(
    {
      organizationId: props.organizationId,
      listingId: props.listingId,
      reportIds: props.reportIds,
      queueHref: props.queueHref,
      staleMessage: labels.stale,
    },
    () => setOpen(false),
  );
  const options = resolveOutcomeOptions({
    canHide: props.canHide,
    canBlockAccounts: props.canBlockAccounts,
  });

  return (
    <>
      <StickyActionBar label={labels.open}>
        <Button variant="primary" disabled={busy} onClick={() => setOpen(true)}>
          {labels.open}
        </Button>
      </StickyActionBar>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={labels.title} closeLabel={labels.close}>
          <OutcomeChoices
            options={options}
            selected={outcome}
            busy={busy}
            labels={labels}
            onSelect={setOutcome}
          />
          <ResolveNoteField note={note} busy={busy} label={labels.note} onChange={setNote} />
          {failed ? (
            <p className="text-small text-danger" role="alert">
              {labels.failure}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit(outcome, note)}>
              {labels.submit}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
