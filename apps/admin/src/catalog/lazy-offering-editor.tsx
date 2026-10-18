"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import type { ComponentType, ReactElement } from "react";
import type { OfferingEditorProps } from "./offering-editor";

async function loadEditor(): Promise<ComponentType<OfferingEditorProps>> {
  const editorModule = await import("./offering-editor");
  return editorModule.default;
}

/**
 * The editor is long, so its code loads right after the page shows (13-UX section 11): the route's
 * first load stays small and the form appears a moment later.
 */
export function LazyOfferingEditor(props: OfferingEditorProps): ReactElement {
  const Editor = useLazyComponent(loadEditor, true);
  if (!Editor) return <p className="text-small text-secondary">{props.labels["editor.loading"]}</p>;
  return <Editor {...props} />;
}
