"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { useCallback, type ComponentType, type ReactElement } from "react";
import type { ReviewActionsProps } from "./review-actions";

/** Loads approve/reject/hide after the listing body is on screen (plan M.3 route budget). */
export function LazyReviewActions(props: ReviewActionsProps): ReactElement | null {
  const load = useCallback(async (): Promise<ComponentType<ReviewActionsProps>> => {
    const loaded = await import("./review-actions");
    return loaded.ReviewActions;
  }, []);
  const Actions = useLazyComponent(load, true);
  if (!Actions) return null;
  return <Actions {...props} />;
}
