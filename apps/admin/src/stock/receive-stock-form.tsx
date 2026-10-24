"use client";

import type { LocationResponse } from "@banijjik/contracts";
import type { CurrencyCode } from "@banijjik/contracts";
import type { UnitKey } from "@banijjik/contracts/catalog";
import type { StockReceiptPaidVia } from "@banijjik/contracts/inventory";
import { Button } from "@banijjik/ui";
import { useMemo, useState, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { receiveStock } from "./stock-api";
import { emptyReceiptLine, validateReceiptLines, type ReceiptLine } from "./receive-stock-form-lib";
import { ReceiveStockLocationField } from "./receive-stock-location-field";
import { ReceiveStockPaidViaField } from "./receive-stock-paid-via-field";
import { appendReceiptLine, ReceiveStockLines } from "./receive-stock-lines";
import type { ItemPickerLabels, ReceiveStockLabels } from "./stock-labels";

export interface ReceiveStockFormProps {
  organizationId: string;
  currency: CurrencyCode;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabels: Record<UnitKey, string>;
  onClose: () => void;
}

function updateReceiptLine(
  lines: ReceiptLine[],
  index: number,
  changes: Partial<ReceiptLine>,
): ReceiptLine[] {
  return lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line));
}

function useReceiveStockForm(props: ReceiveStockFormProps) {
  const [locationId, setLocationId] = useState(props.defaultLocationId);
  const [paidVia, setPaidVia] = useState<StockReceiptPaidVia>("CASH");
  const [lines, setLines] = useState<ReceiptLine[]>(() => [emptyReceiptLine("0")]);
  const fieldNames = useMemo(
    () => [
      "locationId",
      "paidVia",
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
      const built = validateReceiptLines({
        lines,
        currency: props.currency,
        locationId,
        paidVia,
      });
      if (!built.ok) return { ok: false, fieldErrors: built.errors };
      await receiveStock(props.organizationId, { ...built.body, locationId });
      return { ok: true };
    },
  });

  return { locationId, setLocationId, paidVia, setPaidVia, lines, setLines, submit };
}

export function ReceiveStockForm(props: ReceiveStockFormProps): ReactElement {
  const form = useReceiveStockForm(props);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit.submit();
      }}
    >
      <ReceiveStockLocationField
        locationId={form.locationId}
        locations={props.locations}
        labels={props.labels}
        isSaving={form.submit.isSaving}
        onChange={form.setLocationId}
      />
      <ReceiveStockPaidViaField
        paidVia={form.paidVia}
        labels={props.labels}
        isSaving={form.submit.isSaving}
        error={form.submit.errors["paidVia"]}
        onChange={form.setPaidVia}
      />
      <ReceiveStockLines
        organizationId={props.organizationId}
        lines={form.lines}
        labels={props.labels}
        pickerLabels={props.pickerLabels}
        unitLabels={props.unitLabels}
        isSaving={form.submit.isSaving}
        onUpdate={(index, changes) =>
          form.setLines((current) => updateReceiptLine(current, index, changes))
        }
        onRemove={(index) => form.setLines((current) => current.filter((_, i) => i !== index))}
        onAdd={() => form.setLines((current) => appendReceiptLine(current))}
      />
      <SheetFeedback
        state={form.submit}
        conflict={props.labels.conflict}
        reload={props.labels.reload}
      />
      <Button type="submit" disabled={form.submit.isSaving}>
        {props.labels.save}
      </Button>
    </form>
  );
}
