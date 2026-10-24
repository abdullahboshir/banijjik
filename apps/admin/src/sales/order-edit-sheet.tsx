"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { Sheet, SheetContent, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { OrderApprovalDialog } from "./order-approval";
import { OrderEditBody } from "./order-edit-body";
import type { OrderLabels } from "./order-labels";
import { useOrderEditForm } from "./use-order-edit-form";

export interface OrderEditSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly contactName: string | undefined;
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderLabels;
  readonly onSaved: () => void;
}

/** Edits a draft, placed or confirmed order: contact, lines (with their discounts), discount and note. */
export function OrderEditSheet(props: OrderEditSheetProps): ReactElement {
  const { labels } = props;
  const form = useOrderEditForm(props);
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        title={labels.edit.title}
        description={labels.edit.subtitle}
        closeLabel={labels.edit.close}
      >
        <OrderEditBody {...props} form={form} />
      </SheetContent>
      <OrderApprovalDialog flow={form.approval} labels={labels.approval} />
    </Sheet>
  );
}
