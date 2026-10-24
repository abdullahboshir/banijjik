"use client";

import dynamic from "next/dynamic";

/** The edit sheet and its product lookups load only when a staff member asks to edit. */
export const LazyOrderEditSheet = dynamic(
  async () => (await import("./order-edit-sheet")).OrderEditSheet,
);
