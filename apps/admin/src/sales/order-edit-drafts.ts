"use client";

import type { OrderLineSnapshot, OrderResponse } from "@banijjik/contracts/sales";
import { useEffect, useState } from "react";
import { getOffering } from "./order-api";
import { discountToText, emptyOrderLine, type OrderLineDraft } from "./order-lines";

export interface EditDrafts {
  readonly lines: readonly OrderLineDraft[];
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
}

/** The stored line, with its manual discount, as the editor shows it (Amendment 1). */
function draftOf(line: OrderLineSnapshot, offering: OrderLineDraft["offering"]): OrderLineDraft {
  const discount = discountToText(line.manualDiscount);
  return {
    draftId: line.orderLineId,
    offering,
    variantId: line.variantId,
    quantity: String(line.quantity),
    modifierOptionIds: line.modifiers.map((modifier) => modifier.modifierOptionId),
    discountType: discount.type,
    discountText: discount.text,
    performedByMemberId: line.performedByMemberId,
  };
}

async function loadDrafts(organizationId: string, order: OrderResponse): Promise<OrderLineDraft[]> {
  const offerings = await Promise.all(
    order.lines.map((line) => getOffering(organizationId, line.offeringId)),
  );
  return order.lines.map((line, index) => {
    const offering = offerings[index];
    return offering === undefined ? emptyOrderLine(line.orderLineId) : draftOf(line, offering);
  });
}

/** Loads each stored line's product once the sheet opens, so the editor can show units and add-ons. */
export function useEditDrafts(
  open: boolean,
  organizationId: string,
  order: OrderResponse,
): EditDrafts {
  const [state, setState] = useState<EditDrafts>({
    lines: [],
    isLoading: false,
    loadFailed: false,
  });
  useEffect(() => {
    if (!open) return undefined;
    let isCurrent = true;
    async function load(): Promise<void> {
      setState({ lines: [], isLoading: true, loadFailed: false });
      try {
        const lines = await loadDrafts(organizationId, order);
        if (isCurrent) setState({ lines, isLoading: false, loadFailed: false });
      } catch {
        if (isCurrent) setState({ lines: [], isLoading: false, loadFailed: true });
      }
    }
    void load();
    return () => {
      isCurrent = false;
    };
  }, [open, organizationId, order]);
  return state;
}
