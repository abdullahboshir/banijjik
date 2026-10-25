"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { CreditPurchaseSheetProps } from "./credit-purchase-sheet";

/** The purchase form loads when the page renders it; the rest of the credits page stays small (M.6 C8). */
const CreditPurchaseSheetLazy = dynamic(
  async () => (await import("./credit-purchase-sheet")).CreditPurchaseSheet,
  { loading: () => <p className="text-body text-secondary">…</p> },
);

export function LazyCreditPurchaseSheet(props: CreditPurchaseSheetProps): ReactElement {
  return <CreditPurchaseSheetLazy {...props} />;
}
