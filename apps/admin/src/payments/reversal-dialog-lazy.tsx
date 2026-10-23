"use client";

import dynamic from "next/dynamic";

export const ReversalDialogLazy = dynamic(
  async () => (await import("./reversal-dialog")).ReversalDialog,
);
