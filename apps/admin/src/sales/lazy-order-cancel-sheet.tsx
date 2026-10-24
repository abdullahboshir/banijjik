"use client";

import dynamic from "next/dynamic";

/** The cancel sheet (and the dialog library it needs) loads when a staff member opens it. */
export const LazyOrderCancelSheet = dynamic(
  async () => (await import("./order-cancel-sheet")).OrderCancelSheet,
);
