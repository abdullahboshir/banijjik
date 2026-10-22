"use client";
import { newId } from "@banijjik/ids";
import { AccountSelect } from "./account-select";
import { lazy, Suspense, useState, type ReactElement } from "react";
import { Button, TextInput, Select, FormField, formatMoney } from "@banijjik/ui";
import {
  MANUAL_JOURNAL_MAX_LINES,
  manualJournalContent,
  type AccountResponse,
  type ManualJournalEntryRequest,
} from "@banijjik/contracts/accounting";
import { entryLines, entryTotals, type EntryLine } from "./entry-form";
const JournalApproval = lazy(() => import("./journal-approval"));
import { useEntrySubmission } from "./use-entry-submission";
import type { BookkeepingLabels } from "./labels";
export type { BookkeepingLabels } from "./labels";
export interface LocationOption {
  locationId: string;
  name: string;
}
export interface EntryFormProps {
  organizationId: string;
  orgSlug: string;
  accounts: readonly AccountResponse[];
  labels: BookkeepingLabels;
  today: string;
  userId: string;
  locale: "bn" | "en";
  locations: readonly LocationOption[];
}
interface EntryState {
  date: string;
  memo: string;
  locationId: string;
  lines: EntryLine[];
}
const blank = (): EntryLine => ({ formLineId: newId(), accountId: "", debit: "", credit: "" });
export function EntryForm(props: EntryFormProps): ReactElement {
  const [state, setState] = useState<EntryState>({
    date: props.today,
    memo: "",
    locationId: "",
    lines: [blank(), blank()],
  });
  const submission = useEntrySubmission(props);
  const parsed = entryLines(state.lines);
  const totals = entryTotals(parsed ?? []);
  const body: ManualJournalEntryRequest = {
    businessDate: state.date,
    memo: state.memo,
    lines: parsed ?? [],
    ...(state.locationId === "" ? {} : { locationId: state.locationId }),
  };
  function change(next: EntryState): void {
    submission.setApprovalBody(undefined);
    setState(next);
  }
  return (
    <form
      className="flex max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (totals.balanced) void submission.submit(body);
      }}
    >
      <fieldset disabled={submission.pending} className="flex flex-col gap-4">
        <EntryFields {...props} state={state} onChange={change} />
        <EntryLineFields
          {...props}
          lines={state.lines}
          onChange={(lines) => change({ ...state, lines })}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={state.lines.length >= MANUAL_JOURNAL_MAX_LINES}
          onClick={() => change({ ...state, lines: [...state.lines, blank()] })}
        >
          {props.labels.addLine}
        </Button>
      </fieldset>
      <EntryBalance totals={totals} labels={props.labels} locale={props.locale} />
      {submission.error !== "" && (
        <p role="alert" className="text-danger">
          {submission.error}
        </p>
      )}
      <Button type="submit" disabled={submission.pending || !totals.balanced}>
        {submission.pending ? props.labels.pending : props.labels.post}
      </Button>
      <PendingEntryApproval {...props} submission={submission} body={body} amount={totals.debit} />
    </form>
  );
}
function EntryFields(
  props: EntryFormProps & { state: EntryState; onChange: (state: EntryState) => void },
): ReactElement {
  const { state, labels, onChange } = props;
  return (
    <>
      <FormField label={labels.date} htmlFor="entry-date">
        <TextInput
          id="entry-date"
          type="date"
          max={props.today}
          value={state.date}
          onChange={(event) => onChange({ ...state, date: event.target.value })}
          required
        />
      </FormField>
      <FormField label={labels.memo} htmlFor="entry-memo">
        <TextInput
          id="entry-memo"
          value={state.memo}
          maxLength={500}
          onChange={(event) => onChange({ ...state, memo: event.target.value })}
          required
        />
      </FormField>
      <FormField label={labels.location} htmlFor="entry-location">
        <Select
          id="entry-location"
          value={state.locationId}
          onChange={(event) => onChange({ ...state, locationId: event.target.value })}
        >
          <option value="">{labels.all}</option>
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
function EntryLineFields(
  props: EntryFormProps & { lines: EntryLine[]; onChange: (lines: EntryLine[]) => void },
): ReactElement {
  function change(index: number, field: keyof EntryLine, value: string): void {
    props.onChange(
      props.lines.map((line, position) =>
        position === index ? { ...line, [field]: value } : line,
      ),
    );
  }
  return (
    <>
      {props.lines.map((line, index) => (
        <fieldset
          key={line.formLineId ?? index}
          className="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-3"
        >
          <legend>
            {props.labels.line} {index + 1}
          </legend>
          <AccountPicker
            {...props}
            index={index}
            value={line.accountId}
            onChange={(value) => change(index, "accountId", value)}
          />
          {(["debit", "credit"] as const).map((side) => (
            <FormField key={side} label={props.labels[side]} htmlFor={`${side}-${index}`}>
              <TextInput
                id={`${side}-${index}`}
                inputMode="decimal"
                value={line[side]}
                onChange={(event) => change(index, side, event.target.value)}
              />
            </FormField>
          ))}
          {props.lines.length > 2 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                props.onChange(props.lines.filter((_, position) => position !== index))
              }
            >
              {props.labels.remove}
            </Button>
          )}
        </fieldset>
      ))}
    </>
  );
}
function AccountPicker(
  props: EntryFormProps & { index: number; value: string; onChange: (value: string) => void },
): ReactElement {
  return (
    <FormField label={props.labels.account} htmlFor={"account-" + props.index}>
      <AccountSelect
        organizationId={props.organizationId}
        accounts={props.accounts}
        labels={props.labels}
        locale={props.locale}
        inputId={"account-" + props.index}
        value={props.value}
        onChange={props.onChange}
        required
      />
    </FormField>
  );
}
function EntryBalance(props: {
  totals: ReturnType<typeof entryTotals>;
  labels: BookkeepingLabels;
  locale: "bn" | "en";
}): ReactElement {
  return (
    <p role="status">
      {props.labels.debit}:{" "}
      {formatMoney({ amount: props.totals.debit, currency: "BDT" }, { locale: props.locale })} ·{" "}
      {props.labels.credit}:{" "}
      {formatMoney({ amount: props.totals.credit, currency: "BDT" }, { locale: props.locale })} ·{" "}
      {props.totals.balanced ? props.labels.balanced : props.labels.unbalanced}
    </p>
  );
}

function PendingEntryApproval(
  props: EntryFormProps & {
    submission: ReturnType<typeof useEntrySubmission>;
    body: ManualJournalEntryRequest;
    amount: number;
  },
): ReactElement | null {
  const { submission, body } = props;
  if (submission.approvalBody === undefined) return null;
  return (
    <Suspense fallback={<p role="status">{props.labels.pending}</p>}>
      <JournalApproval
        organizationId={props.organizationId}
        userId={props.userId}
        locationId={body.locationId ?? ""}
        subjectContent={manualJournalContent(body)}
        amount={props.amount}
        labels={props.labels}
        onCancel={() => submission.setApprovalBody(undefined)}
        onApproved={(token) => {
          submission.setApprovalBody(undefined);
          void submission.submit(body, token);
        }}
      />
    </Suspense>
  );
}
