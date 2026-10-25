"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { MarkdownPreviewProps } from "./markdown-preview";

/** The renderer loads after the page is drawn: the editor's first download stays within the route budget (M.6 C8). */
const MarkdownPreviewLazy = dynamic(
  async () => (await import("./markdown-preview")).MarkdownPreview,
  { loading: () => <p className="text-small text-secondary">…</p> },
);

export function LazyMarkdownPreview(props: MarkdownPreviewProps): ReactElement {
  return <MarkdownPreviewLazy {...props} />;
}
