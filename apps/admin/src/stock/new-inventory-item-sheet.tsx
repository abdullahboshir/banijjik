"use client";

import type { UnitKey } from "@banijjik/contracts/catalog";
import { Sheet, SheetContent } from "@banijjik/ui";
import type { ReactElement } from "react";
import { NewInventoryItemForm } from "./new-inventory-item-form";
import type { NewItemLabels } from "./stock-labels";

export interface NewInventoryItemSheetProps {
  organizationId: string;
  labels: NewItemLabels;
  unitLabels: Record<UnitKey, string>;
  onClose: () => void;
}

export function NewInventoryItemSheet(props: NewInventoryItemSheetProps): ReactElement {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.close}>
        <NewInventoryItemForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
