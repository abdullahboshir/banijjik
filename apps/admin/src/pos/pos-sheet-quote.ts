import type { QuoteRequest } from "@banijjik/contracts/pricing";
import { useEffect, useState } from "react";
import type { CartLine } from "./cart";
import { quoteCart } from "./pos-api";

export type SheetQuote =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly totalMinor: number }
  | { readonly kind: "failed" };

export function quoteRequestOf(locationId: string, lines: readonly CartLine[]): QuoteRequest {
  return {
    locationId,
    lines: lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: [],
      ...(line.unitPriceOverride === null ? {} : { unitPriceOverride: line.unitPriceOverride }),
    })),
  };
}

/** The server's grand total for the cart at this location. Nothing here is priced on the till. */
export function useSheetQuote(
  organizationId: string,
  locationId: string,
  lines: readonly CartLine[],
): SheetQuote {
  const [quote, setQuote] = useState<SheetQuote>({ kind: "loading" });
  useEffect(() => {
    let cancelled = false;
    async function loadQuote(): Promise<void> {
      try {
        const quoted = await quoteCart(organizationId, quoteRequestOf(locationId, lines));
        if (!cancelled) setQuote({ kind: "ready", totalMinor: quoted.totals.grandTotal.amount });
      } catch {
        if (!cancelled) setQuote({ kind: "failed" });
      }
    }
    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [organizationId, locationId, lines]);
  return quote;
}
