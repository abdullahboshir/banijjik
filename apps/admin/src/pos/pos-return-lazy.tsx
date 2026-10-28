"use client";

import dynamic from "next/dynamic";

export const PosReturnLazy = dynamic(
  async () => (await import("./pos-return-sheet")).PosReturnSheet,
);
