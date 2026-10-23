"use client";

import dynamic from "next/dynamic";

// The sheet, the approval PIN dialog and the verify/reject logic load only when staff open a
// purchase, so the queue keeps to the initial script budget (13-UX section 11).
export const CreditPurchaseDetailSheetLazy = dynamic(
  async () => (await import("./credit-purchase-detail-sheet")).CreditPurchaseDetailSheet,
);
