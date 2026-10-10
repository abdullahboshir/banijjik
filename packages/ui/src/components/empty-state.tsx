import type { ReactElement, ReactNode } from "react";

export interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

/** One sentence and one action, no illustration (13-UX section 5). */
export function EmptyState({ message, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <p className="text-body text-secondary">{message}</p>
      {action}
    </div>
  );
}
