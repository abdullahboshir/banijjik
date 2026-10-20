"use client";

import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import { useState, type ReactElement } from "react";
import { labelOf } from "../custom-fields/custom-field-display";

export interface ReviewChecklistProps {
  reasons: DirectoryConfigResponse["rejectionReasons"];
  locale: Locale;
  title: string;
  help: string;
  noneApplyLabel: string;
}

/**
 * Local-only checklist: the reviewer ticks that each rejection reason does not apply.
 * Not stored (lead answer for M.3).
 */
export function ReviewChecklist(props: ReviewChecklistProps): ReactElement {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-default p-4">
      <legend className="px-1 text-body font-semibold text-primary">{props.title}</legend>
      <p className="text-small text-secondary">{props.help}</p>
      {props.reasons.map((reason) => {
        const isOn = checked.has(reason.reasonKey);
        return (
          <label
            key={reason.reasonKey}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1"
          >
            <input
              type="checkbox"
              checked={isOn}
              className="mt-1 size-5 shrink-0"
              onChange={() => {
                const next = new Set(checked);
                if (isOn) next.delete(reason.reasonKey);
                else next.add(reason.reasonKey);
                setChecked(next);
              }}
            />
            <span className="text-body text-primary">
              {props.noneApplyLabel}: {labelOf(reason.label, props.locale)}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
