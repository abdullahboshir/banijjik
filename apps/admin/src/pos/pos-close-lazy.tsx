"use client";

import dynamic from "next/dynamic";

/** Loaded when the cashier closes the register, so the sale screen stays inside the 180 KiB budget. */
export const PosCloseLazy = dynamic(
  async () => (await import("./pos-close-screen")).PosCloseScreen,
);
