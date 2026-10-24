"use client";

import dynamic from "next/dynamic";

/** The search box and its results stay out of the first load of the order screens. */
export const LazyProductPicker = dynamic(
  async () => (await import("./product-picker")).ProductPicker,
);
