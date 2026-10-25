"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { EraseAccountDialogProps } from "./erase-account-dialog";

/** The erase step loads only when the customer opens the account page's erase section (M.6 C8). */
const EraseAccountDialogLazy = dynamic(
  async () => (await import("./erase-account-dialog")).EraseAccountDialog,
  { loading: () => <p className="text-body text-secondary">…</p> },
);

export function LazyEraseAccountDialog(props: EraseAccountDialogProps): ReactElement {
  return <EraseAccountDialogLazy {...props} />;
}
