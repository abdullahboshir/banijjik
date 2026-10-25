"use client";

import dynamic from "next/dynamic";

/** The reverse sheet loads only when a staff member opens it on a return. */
export const LazyReturnReverseSheet = dynamic(
  async () => (await import("./return-reverse-sheet")).ReturnReverseSheet,
);
