"use client";

import dynamic from "next/dynamic";

export const PosPriceOverrideLazy = dynamic(
  async () => (await import("./pos-price-override-sheet")).PosPriceOverrideSheet,
);
