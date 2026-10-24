"use client";

import dynamic from "next/dynamic";

/** The manager PIN sheet loads only when a refusal asks for an approval. */
export const LazyOrderApprovalDialog = dynamic(
  async () => (await import("./order-approval-dialog")).OrderApprovalDialog,
);
