"use client";

import dynamic from "next/dynamic";

/** The exchange sheet (its steps, preview and PIN dialogs) loads only when a staff member opens it (plan 3.5b B2). */
export const LazyExchangeSheet = dynamic(
  async () => (await import("./exchange-sheet")).ExchangeSheet,
);
