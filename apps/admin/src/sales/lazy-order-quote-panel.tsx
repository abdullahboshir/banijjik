"use client";

import dynamic from "next/dynamic";

/** The live totals arrive with their own chunk; the rest of the order screen does not wait for it. */
export const LazyOrderQuotePanel = dynamic(
  async () => (await import("./order-quote-panel")).OrderQuotePanel,
);
