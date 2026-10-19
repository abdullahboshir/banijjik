"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { transferStock } from "./stock-api";
import { emptyTransferLine, validateTransfer, type TransferLine } from "./transfer-form-lib";
import { TransferLocationFields } from "./transfer-location-fields";
import { appendTransferLine, TransferLines } from "./transfer-lines";
import type { ItemPickerLabels, TransferLabels } from "./stock-labels";

export interface TransferFormProps {
  organizationId: string;
  locations: readonly LocationResponse[];
  defaultFromLocationId: string;
  labels: TransferLabels;
  pickerLabels: ItemPickerLabels;
}

export function TransferForm(props: TransferFormProps): ReactElement {
  const [fromLocationId, setFromLocationId] = useState(props.defaultFromLocationId);
  const [toLocationId, setToLocationId] = useState(
    props.locations.find((location) => location.locationId !== props.defaultFromLocationId)
      ?.locationId ?? props.defaultFromLocationId,
  );
  const [lines, setLines] = useState<TransferLine[]>(() => [emptyTransferLine("0")]);

  const submit = useSheetSubmit({
    fieldNames: ["fromLocationId", "toLocationId", "lines"],
    onClose: () => undefined,
    send: async () => {
      const built = validateTransfer(fromLocationId, toLocationId, lines);
      if (!built.ok) return { ok: false, fieldErrors: built.errors };
      await transferStock(props.organizationId, built.body);
      return { ok: true };
    },
  });

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    void submit.submit();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <TransferLocationFields
        fromLocationId={fromLocationId}
        toLocationId={toLocationId}
        locations={props.locations}
        labels={props.labels}
        isSaving={submit.isSaving}
        onFromChange={setFromLocationId}
        onToChange={setToLocationId}
      />
      <TransferLines
        organizationId={props.organizationId}
        lines={lines}
        labels={props.labels}
        pickerLabels={props.pickerLabels}
        isSaving={submit.isSaving}
        onUpdate={(index, changes) =>
          setLines((current) =>
            current.map((line, lineIndex) =>
              lineIndex === index ? { ...line, ...changes } : line,
            ),
          )
        }
        onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))}
        onAdd={() => setLines((current) => appendTransferLine(current))}
      />
      <SheetFeedback state={submit} conflict={props.labels.conflict} reload={props.labels.reload} />
      <Button type="submit" disabled={submit.isSaving}>
        {props.labels.submit}
      </Button>
    </form>
  );
}
