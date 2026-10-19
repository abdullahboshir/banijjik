"use client";

import type { LocationResponse } from "@banijjik/contracts";
import type { CurrencyCode } from "@banijjik/contracts";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { Sheet, SheetContent } from "@banijjik/ui";
import type { ReactElement } from "react";
import { ReceiveStockForm } from "./receive-stock-form";
import type { ItemPickerLabels, ReceiveStockLabels } from "./stock-labels";

export interface ReceiveStockSheetProps {
  organizationId: string;
  currency: CurrencyCode;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabels: Record<UnitKey, string>;
  onClose: () => void;
}

export function ReceiveStockSheet(props: ReceiveStockSheetProps): ReactElement {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.close}>
        <ReceiveStockForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
