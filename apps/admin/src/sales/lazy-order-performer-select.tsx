"use client";

import dynamic from "next/dynamic";

/** The performer select and its lookup load only for a commission-enabled business (budget of the new-order route). */
export const LazyOrderPerformerSelect = dynamic(
  async () => (await import("./order-performer-select")).OrderPerformerSelect,
);
