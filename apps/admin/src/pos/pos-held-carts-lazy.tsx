"use client";

import dynamic from "next/dynamic";
export type { HeldCartMode } from "./pos-held-carts";

export const PosHeldCartsLazy = dynamic(
  async () => (await import("./pos-held-carts")).PosHeldCarts,
);
