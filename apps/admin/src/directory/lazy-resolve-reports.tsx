"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { useCallback, type ComponentType, type ReactElement } from "react";
import type { ResolveReportsProps } from "./resolve-reports";

/** Loads the resolve sheet after the reports are on screen (route budget, plan M.7 decision 12). */
export function LazyResolveReports(props: ResolveReportsProps): ReactElement | null {
  const load = useCallback(async (): Promise<ComponentType<ResolveReportsProps>> => {
    const loaded = await import("./resolve-reports");
    return loaded.ResolveReports;
  }, []);
  const Resolve = useLazyComponent(load, true);
  if (!Resolve) return null;
  return <Resolve {...props} />;
}
