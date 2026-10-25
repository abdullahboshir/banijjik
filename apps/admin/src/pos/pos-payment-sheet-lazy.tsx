"use client";

import dynamic from "next/dynamic";

/** Loaded when the cashier presses Pay, so the first sale screen stays inside the 180 KiB budget. */
export const PosPaymentSheetLazy = dynamic(
  async () => (await import("./pos-payment-sheet")).PosPaymentSheet,
);
