"use client";

import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { CartLine } from "./cart";
import type { PosLabels } from "./pos-labels";

export interface PosCartPanelProps {
  readonly labels: PosLabels;
  readonly lines: readonly CartLine[];
  readonly onQuantity: (lineKey: string, quantity: number) => void;
  readonly onRemove: (lineKey: string) => void;
  readonly onClear: () => void;
}

const TOUCH_TARGET_CLASS = "min-h-14 min-w-14";

function CartLineRow(props: {
  readonly line: CartLine;
  readonly labels: PosLabels;
  readonly onQuantity: (lineKey: string, quantity: number) => void;
  readonly onRemove: (lineKey: string) => void;
}): ReactElement {
  const { line, labels, onQuantity, onRemove } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default bg-surface p-3">
      <div className="text-body font-semibold text-primary">
        {line.offeringName}
        <span className="text-secondary"> · {line.variantName}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className={TOUCH_TARGET_CLASS}
            aria-label={`-1 ${line.offeringName}`}
            onClick={() => onQuantity(line.lineKey, line.quantity - 1)}
          >
            −
          </Button>
          <span className="min-w-10 text-center text-h3 font-semibold">{line.quantity}</span>
          <Button
            variant="secondary"
            className={TOUCH_TARGET_CLASS}
            aria-label={`+1 ${line.offeringName}`}
            onClick={() => onQuantity(line.lineKey, line.quantity + 1)}
          >
            +
          </Button>
        </div>
        <Button variant="ghost" className="min-h-14" onClick={() => onRemove(line.lineKey)}>
          {labels.remove}
        </Button>
      </div>
    </li>
  );
}

/** The cart shows quantities only. Money appears after the server has quoted the sale (plan 3.9 decision 14). */
export function PosCartPanel(props: PosCartPanelProps): ReactElement {
  const { labels, lines, onQuantity, onRemove, onClear } = props;
  if (lines.length === 0) {
    return <p className="text-body text-secondary">{labels.cartEmpty}</p>;
  }
  return (
    <section aria-label={labels.cart} className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <CartLineRow
            key={line.lineKey}
            line={line}
            labels={labels}
            onQuantity={onQuantity}
            onRemove={onRemove}
          />
        ))}
      </ul>
      <Button variant="ghost" className="min-h-14 self-end" onClick={onClear}>
        {labels.clear}
      </Button>
    </section>
  );
}
