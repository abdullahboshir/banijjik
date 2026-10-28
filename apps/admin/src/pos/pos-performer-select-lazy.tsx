"use client";

import dynamic from "next/dynamic";

/** Stays out of the first load of `/pos` so the route budget keeps room for the sale screen. */
export const PosPerformerSelectLazy = dynamic(
  async () => (await import("./pos-performer-select")).PosPerformerSelect,
);
