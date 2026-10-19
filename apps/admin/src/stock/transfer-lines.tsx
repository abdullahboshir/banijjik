"use client";

import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { emptyTransferLine, type TransferLine } from "./transfer-form-lib";
import { TransferLineEditor } from "./transfer-line";
import type { ItemPickerLabels, TransferLabels } from "./stock-labels";

export function TransferLines(props: {
  organizationId: string;
  lines: TransferLine[];
  labels: TransferLabels;
  pickerLabels: ItemPickerLabels;
  isSaving: boolean;
  onUpdate: (index: number, changes: Partial<TransferLine>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}): ReactElement {
  return (
    <>
      {props.lines.map((line, index) => (
        <TransferLineEditor
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

export function appendTransferLine(lines: TransferLine[]): TransferLine[] {
  return [...lines, emptyTransferLine(String(lines.length))];
}
