"use client";

import dynamic from "next/dynamic";

export const RefundDialogLazy = dynamic(async () => (await import("./refund-dialog")).RefundDialog);
