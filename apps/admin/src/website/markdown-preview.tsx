"use client";

import { renderMarkdown } from "@banijjik/ui/markdown";
import type { ReactElement } from "react";

export interface MarkdownPreviewProps {
  readonly markdown: string;
}

/** The preview of a page body, drawn with the same rules as the storefront (M.6 decision 12). */
export function MarkdownPreview({ markdown }: MarkdownPreviewProps): ReactElement {
  return <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />;
}
