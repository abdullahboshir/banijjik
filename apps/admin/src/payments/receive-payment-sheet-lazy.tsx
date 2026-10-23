"use client";

import dynamic from "next/dynamic";

export const ReceivePaymentSheetLazy = dynamic(
  async () => (await import("./receive-payment-sheet")).ReceivePaymentSheet,
);
