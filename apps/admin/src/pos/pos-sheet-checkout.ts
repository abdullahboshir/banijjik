import type { Money } from "@banijjik/contracts/payment";
import type { PosSaleResponse } from "@banijjik/contracts/pos";
import { useRef, useState } from "react";
import { useTranslator } from "@banijjik/web-client/client";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { attemptFor, type CheckoutAttempt } from "./attempt-key";
import type { CartLine } from "./cart";
import { createSale } from "./pos-api";
import { buildSaleBody } from "./pos-sale-body";
import type { TenderPlan } from "./till-payment";

/** Who the sale is for and the store credit it uses; both null for an anonymous cash sale. */
export interface SaleCustomerInput {
  readonly contactId: string | null;
  readonly storeCreditUse: Money | null;
}

export interface SheetCheckout {
  readonly pending: boolean;
  readonly saleFailed: string | undefined;
  readonly confirm: (plan: TenderPlan, customer: SaleCustomerInput) => Promise<void>;
}

export interface SheetCheckoutInput {
  readonly organizationId: string;
  readonly lines: readonly CartLine[];
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly priceOverrideToken: string | null;
}

/**
 * Sends the sale for a valid tender. The attempt key is kept while the body stays the same, so a
 * retry after a lost answer replays the first sale (ADR-014).
 */
export function useSheetCheckout(input: SheetCheckoutInput): SheetCheckout {
  const { t } = useTranslator();
  const [pending, setPending] = useState(false);
  const [saleFailed, setSaleFailed] = useState<string | undefined>();
  const attemptRef = useRef<CheckoutAttempt | null>(null);

  async function confirm(plan: TenderPlan, customer: SaleCustomerInput): Promise<void> {
    if (!plan.ok) return;
    const body = buildSaleBody({
      lines: input.lines,
      payments: plan.payments,
      cashTendered: plan.cashTendered,
      contactId: customer.contactId,
      storeCreditUse: customer.storeCreditUse,
      priceOverrideToken: input.priceOverrideToken,
    });
    const attempt = attemptFor(attemptRef.current, JSON.stringify(body));
    attemptRef.current = attempt;
    setPending(true);
    setSaleFailed(undefined);
    try {
      input.onPaid(await createSale(input.organizationId, body, attempt.idempotencyKey));
    } catch (error) {
      setSaleFailed(
        error instanceof ApiError
          ? t(knownMessageKeyOrInternal(error.messageKey))
          : t("pos.sale.failed"),
      );
    } finally {
      setPending(false);
    }
  }

  return { pending, saleFailed, confirm };
}
