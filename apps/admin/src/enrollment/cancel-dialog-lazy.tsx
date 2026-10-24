"use client";

import dynamic from "next/dynamic";

export const CancelDialogLazy = dynamic(async () => (await import("./cancel-dialog")).CancelDialog);
