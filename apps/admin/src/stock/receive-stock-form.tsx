"use client";

import type { LocationResponse } from "@banijjik/contracts";
import type { CurrencyCode } from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useMemo, useState, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { receiveStock } from "./stock-api";
import { emptyReceiptLine, validateReceiptLines, type ReceiptLine } from "./receive-stock-form-lib";
import { ReceiveStockLocationField } from "./receive-stock-location-field";
import { appendReceiptLine, ReceiveStockLines } from "./receive-stock-lines";
import type { ItemPickerLabels, ReceiveStockLabels } from "./stock-labels";

export interface ReceiveStockFormProps {
  organizationId: string;
  currency: CurrencyCode;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabel: (unitKey: string) => string;
  onClose: () => void;
}

function updateReceiptLine(
  lines: ReceiptLine[],
  index: number,
  changes: Partial<ReceiptLine>,
): ReceiptLine[] {
  return lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line));
}

export function ReceiveStockForm(props: ReceiveStockFormProps): ReactElement {
  const [locationId, setLocationId] = useState(props.defaultLocationId);
  const [lines, setLines] = useState<ReceiptLine[]>(() => [emptyReceiptLine("0")]);
  const fieldNames = useMemo(
    () => [
      "locationId",
      "lines",
      ...lines.flatMap((_, index) => [
        `line-${index}-item`,
        `line-${index}-quantity`,
        `line-${index}-unitCost`,
      ]),
    ],
    [lines],
  );
  const submit = useSheetSubmit({
    fieldNames,
    onClose: props.onClose,
    send: async () => {
      const built = validateReceiptLines(lines, props.currency, locationId);
      if (!built.ok) return { ok: false, fieldErrors: built.errors };
      await receiveStock(props.organizationId, { ...built.body, locationId });
      return { ok: true };
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit.submit();
      }}
    >
      <ReceiveStockLocationField
        locationId={locationId}
        locations={props.locations}
        labels={props.labels}
        isSaving={submit.isSaving}
        onChange={setLocationId}
      />
      <ReceiveStockLines
        organizationId={props.organizationId}
        lines={lines}
        labels={props.labels}
        pickerLabels={props.pickerLabels}
        unitLabel={props.unitLabel}
        isSaving={submit.isSaving}
        onUpdate={(index, changes) =>
          setLines((current) => updateReceiptLine(current, index, changes))
        }
        onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))}
        onAdd={() => setLines((current) => appendReceiptLine(current))}
      />
      <SheetFeedback state={submit} conflict={props.labels.conflict} reload={props.labels.reload} />
      <Button type="submit" disabled={submit.isSaving}>
        {props.labels.save}
      </Button>
    </form>
  );
}
