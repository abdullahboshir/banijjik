"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { useCallback, type ComponentType, type ReactElement } from "react";
import type { ListingSectionsProps } from "./listing-sections";

/** Loads the heavy section renderer after the review chrome is on screen (plan M.3 budget). */
export function LazyListingSections(props: ListingSectionsProps): ReactElement | null {
  const load = useCallback(async (): Promise<ComponentType<ListingSectionsProps>> => {
    const loaded = await import("./listing-sections");
    return loaded.ListingSections;
  }, []);
  const Sections = useLazyComponent(load, true);
  if (!Sections) return null;
  return <Sections {...props} />;
}
