"use client";

import dynamic from "next/dynamic";

export const LazyOrderDeleteDialog = dynamic(
  async () => (await import("./order-delete-dialog")).OrderDeleteDialog,
);
