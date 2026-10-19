"use client";

import type { UnitKey } from "@banijjik/contracts/catalog";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { emptyReceiptLine, type ReceiptLine } from "./receive-stock-form-lib";
import { ReceiveStockLine } from "./receive-stock-line";
import type { ItemPickerLabels, ReceiveStockLabels } from "./stock-labels";

export function ReceiveStockLines(props: {
  organizationId: string;
  lines: ReceiptLine[];
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabels: Record<UnitKey, string>;
  isSaving: boolean;
  onUpdate: (index: number, changes: Partial<ReceiptLine>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}): ReactElement {
  return (
    <>
      {props.lines.map((line, index) => (
        <ReceiveStockLine
          key={line.key}
          organizationId={props.organizationId}
          index={index}
          line={line}
          labels={props.labels}
          pickerLabels={props.pickerLabels}
          unitLabels={props.unitLabels}
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

export function nextReceiptLineKey(lines: ReceiptLine[]): string {
  return String(lines.length);
}

export function appendReceiptLine(lines: ReceiptLine[]): ReceiptLine[] {
  return [...lines, emptyReceiptLine(nextReceiptLineKey(lines))];
}
