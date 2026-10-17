import type { ReactElement, ReactNode } from "react";
import { EmptyIllustration, type EmptyStateKind } from "./empty-illustrations.js";

export type { EmptyStateKind } from "./empty-illustrations.js";

export interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  /** Which line drawing to show: nothing yet (default), nothing found, or not allowed. */
  kind?: EmptyStateKind;
}

/** A line drawing, one sentence and one action (13-UX section 5, ADR-112). */
export function EmptyState({ message, action, kind = "none" }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <EmptyIllustration kind={kind} />
      <p className="text-body text-secondary">{message}</p>
      {action}
    </div>
  );
}
