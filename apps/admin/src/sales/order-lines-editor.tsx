"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLineLabels } from "./order-labels";
import { OrderLineCard } from "./order-line-card";
import type { OrderLineDraft } from "./order-lines";

export interface OrderLinesEditorProps {
  readonly organizationId: string;
  readonly lines: readonly OrderLineDraft[];
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderLineLabels;
  readonly disabled: boolean;
  readonly onChange: (lines: readonly OrderLineDraft[]) => void;
}

/** One card per product line: search, variant, quantity in the unit's words, add-ons and discount. */
export function OrderLinesEditor(props: OrderLinesEditorProps): ReactElement {
  function update(index: number, changes: Partial<OrderLineDraft>): void {
    props.onChange(
      props.lines.map((line, position) => (position === index ? { ...line, ...changes } : line)),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {props.lines.map((line, index) => (
        <OrderLineCard
          key={line.draftId}
          index={index}
          line={line}
          editor={props}
          onChange={(changes) => update(index, changes)}
          onRemove={() => props.onChange(props.lines.filter((_, position) => position !== index))}
        />
      ))}
    </div>
  );
}
