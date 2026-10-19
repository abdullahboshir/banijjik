"use client";

import { Sheet, SheetContent } from "@banijjik/ui";
import type { ReactElement } from "react";
import { AdjustStockForm, type AdjustStockFormProps } from "./adjust-stock-form";

export interface AdjustStockSheetProps extends Omit<AdjustStockFormProps, "onSuccess"> {
  labels: AdjustStockFormProps["labels"] & { title: string; close: string };
  onClose: () => void;
}

export function AdjustStockSheet(props: AdjustStockSheetProps): ReactElement {
  const { labels, onClose, ...formProps } = props;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent title={labels.title} closeLabel={labels.close}>
        <AdjustStockForm {...formProps} labels={labels} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
