"use client";

import { UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import { Button } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { NewInventoryItemFields } from "./new-inventory-item-fields";
import { createInventoryItem } from "./stock-api";
import type { NewItemLabels } from "./stock-labels";

export function NewInventoryItemForm(props: {
  organizationId: string;
  labels: NewItemLabels;
  unitLabels: Record<UnitKey, string>;
  onClose: () => void;
}): ReactElement {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [baseUnitKey, setBaseUnitKey] = useState<UnitKey>(UNIT_KEY.GRAM);

  const submit = useSheetSubmit({
    fieldNames: ["name", "sku", "baseUnitKey"],
    onClose: props.onClose,
    send: async () => {
      if (name.trim() === "") return { ok: false, fieldErrors: { name: "validation.required" } };
      await createInventoryItem(props.organizationId, {
        name: name.trim(),
        baseUnitKey,
        ...(sku.trim() ? { sku: sku.trim() } : {}),
      });
      return { ok: true };
    },
  });

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    void submit.submit();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <NewInventoryItemFields
        labels={props.labels}
        name={name}
        sku={sku}
        baseUnitKey={baseUnitKey}
        unitLabels={props.unitLabels}
        isSaving={submit.isSaving}
        onNameChange={setName}
        onSkuChange={setSku}
        onUnitChange={setBaseUnitKey}
      />
      <SheetFeedback state={submit} conflict={props.labels.conflict} reload={props.labels.reload} />
      <Button type="submit" disabled={submit.isSaving}>
        {props.labels.save}
      </Button>
    </form>
  );
}
