"use client";

import dynamic from "next/dynamic";

/** The return sheet (its line picker, preview and PIN dialog) loads only when a staff member opens it. */
export const LazyReturnSheet = dynamic(async () => (await import("./return-sheet")).ReturnSheet);
