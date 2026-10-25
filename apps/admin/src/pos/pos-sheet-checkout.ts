import type { PosSaleResponse } from "@banijjik/contracts/pos";
import { useRef, useState } from "react";
import { attemptFor, type CheckoutAttempt } from "./attempt-key";
import type { CartLine } from "./cart";
import { createSale } from "./pos-api";
import { buildSaleBody } from "./pos-sale-body";
import type { TenderPlan } from "./till-payment";

export interface SheetCheckout {
  readonly pending: boolean;
  readonly saleFailed: boolean;
  readonly confirm: (plan: TenderPlan) => Promise<void>;
}

/**
 * Sends the sale for a valid tender. The attempt key is kept while the body stays the same, so a
 * retry after a lost answer replays the first sale (ADR-014).
 */
export function useSheetCheckout(
  organizationId: string,
  lines: readonly CartLine[],
  onPaid: (sale: PosSaleResponse) => void,
): SheetCheckout {
  const [pending, setPending] = useState(false);
  const [saleFailed, setSaleFailed] = useState(false);
  const attemptRef = useRef<CheckoutAttempt | null>(null);

  async function confirm(plan: TenderPlan): Promise<void> {
    if (!plan.ok) return;
    const body = buildSaleBody({ lines, payments: plan.payments, cashTendered: plan.cashTendered });
    const attempt = attemptFor(attemptRef.current, JSON.stringify(body));
    attemptRef.current = attempt;
    setPending(true);
    setSaleFailed(false);
    try {
      onPaid(await createSale(organizationId, body, attempt.idempotencyKey));
    } catch {
      setSaleFailed(true);
    } finally {
      setPending(false);
    }
  }

  return { pending, saleFailed, confirm };
}
