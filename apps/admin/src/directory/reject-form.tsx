"use client";

import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import { Button, FormField, Textarea } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { labelOf } from "../custom-fields/custom-field-display";
import { canSubmitReject, toggleReasonKey } from "./reject-form-state";

export interface RejectFormLabels {
  title: string;
  reasons: string;
  finalMark: string;
  note: string;
  submit: string;
  cancel: string;
  reasonRequired: string;
}

export interface RejectFormProps {
  reasons: DirectoryConfigResponse["rejectionReasons"];
  locale: Locale;
  labels: RejectFormLabels;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { reasonKeys: readonly string[]; note?: string }) => void;
}

function ReasonChips(props: {
  reasons: DirectoryConfigResponse["rejectionReasons"];
  selected: readonly string[];
  locale: Locale;
  finalMark: string;
  busy: boolean;
  onToggle: (reasonKey: string) => void;
}): ReactElement {
  return (
    <>
      {props.reasons.map((reason) => (
        <label
          key={reason.reasonKey}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-default px-3"
        >
          <input
            type="checkbox"
            checked={props.selected.includes(reason.reasonKey)}
            disabled={props.busy}
            onChange={() => props.onToggle(reason.reasonKey)}
            className="size-5"
          />
          <span className="text-body text-primary">
            {labelOf(reason.label, props.locale)}
            {reason.isFinal ? (
              <span className="ml-2 text-caption text-danger">{props.finalMark}</span>
            ) : null}
          </span>
        </label>
      ))}
    </>
  );
}

/** Multi-select rejection reasons from the template; at least one reason is required. */
export function RejectForm(props: RejectFormProps): ReactElement {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [note, setNote] = useState("");
  const [showError, setShowError] = useState(false);
  const canSubmit = canSubmitReject(selected);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-default p-4">
      <h3 className="text-body font-semibold text-primary">{props.labels.title}</h3>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small text-secondary">{props.labels.reasons}</legend>
        <ReasonChips
          reasons={props.reasons}
          selected={selected}
          locale={props.locale}
          finalMark={props.labels.finalMark}
          busy={props.busy}
          onToggle={(reasonKey) => setSelected(toggleReasonKey(selected, reasonKey))}
        />
      </fieldset>
      {showError && !canSubmit ? (
        <p className="text-small text-danger" role="alert">
          {props.labels.reasonRequired}
        </p>
      ) : null}
      <FormField label={props.labels.note} htmlFor="directory-reject-note">
        <Textarea
          id="directory-reject-note"
          value={note}
          disabled={props.busy}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={props.busy} onClick={props.onCancel}>
          {props.labels.cancel}
        </Button>
        <Button
          variant="danger"
          disabled={props.busy}
          onClick={() => {
            if (!canSubmit) {
              setShowError(true);
              return;
            }
            const trimmed = note.trim();
            props.onSubmit({
              reasonKeys: selected,
              ...(trimmed.length === 0 ? {} : { note: trimmed }),
            });
          }}
        >
          {props.labels.submit}
        </Button>
      </div>
    </div>
  );
}
