"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { AdjustStockApprovalDialog } from "./adjust-stock-approval-dialog";
import { AdjustLocationField, AdjustStockLine } from "./adjust-stock-line";
import { emptyAdjustLine, type AdjustLine } from "./adjust-stock-form-lib";
import type { AdjustStockLabels, ItemPickerLabels } from "./stock-labels";
import { useAdjustStockSubmit } from "./use-adjust-stock-submit";

export interface AdjustStockFormProps {
  organizationId: string;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: AdjustStockLabels;
  pickerLabels: ItemPickerLabels;
  onSuccess?: () => void;
  onClose?: () => void;
}

function AdjustStockLines(props: {
  organizationId: string;
  lines: AdjustLine[];
  labels: AdjustStockLabels;
  pickerLabels: ItemPickerLabels;
  isSaving: boolean;
  onUpdate: (index: number, changes: Partial<AdjustLine>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}): ReactElement {
  return (
    <>
      {props.lines.map((line, index) => (
        <AdjustStockLine
          key={line.key}
          organizationId={props.organizationId}
          index={index}
          line={line}
          labels={props.labels}
          pickerLabels={props.pickerLabels}
          isSaving={props.isSaving}
          canRemove={props.lines.length > 1}
          onChange={(changes) => props.onUpdate(index, changes)}
          onRemove={() => props.onRemove(index)}
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={props.isSaving || props.lines.length >= 100}
        onClick={props.onAdd}
      >
        {props.labels.addLine}
      </Button>
    </>
  );
}

export function AdjustStockForm(props: AdjustStockFormProps): ReactElement {
  const [locationId, setLocationId] = useState(props.defaultLocationId);
  const [lines, setLines] = useState<AdjustLine[]>(() => [emptyAdjustLine("0")]);
  const approval = useAdjustStockSubmit({
    organizationId: props.organizationId,
    locationId,
    lines,
    ...(props.onSuccess === undefined ? {} : { onSuccess: props.onSuccess }),
    ...(props.onClose === undefined ? {} : { onClose: props.onClose }),
  });

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    void approval.submit.submit();
  }

  return (
    <>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <AdjustLocationField
          locationId={locationId}
          locations={props.locations}
          labels={props.labels}
          isSaving={approval.submit.isSaving}
          onChange={setLocationId}
        />
        <AdjustStockLines
          organizationId={props.organizationId}
          lines={lines}
          labels={props.labels}
          pickerLabels={props.pickerLabels}
          isSaving={approval.submit.isSaving}
          onUpdate={(index, changes) =>
            setLines((current) =>
              current.map((line, lineIndex) =>
                lineIndex === index ? { ...line, ...changes } : line,
              ),
            )
          }
          onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))}
          onAdd={() => setLines((current) => [...current, emptyAdjustLine(String(current.length))])}
        />
        <SheetFeedback
          state={approval.submit}
          conflict={props.labels.conflict}
          reload={props.labels.reload}
        />
        <Button type="submit" disabled={approval.submit.isSaving}>
          {props.labels.save}
        </Button>
      </form>
      <AdjustStockApprovalDialog
        labels={props.labels}
        pinOpen={approval.pinOpen}
        setPinOpen={approval.setPinOpen}
        approvers={approval.approvers}
        isGranting={approval.isGranting}
        approvalError={approval.approvalError}
        onApproval={approval.onApproval}
      />
    </>
  );
}
