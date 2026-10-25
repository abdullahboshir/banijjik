"use client";

import dynamic from "next/dynamic";

/** Loaded after a completed sale, with the receipt CSS and layout. */
export const PosReceiptLazy = dynamic(async () => (await import("./pos-receipt")).PosReceipt);
