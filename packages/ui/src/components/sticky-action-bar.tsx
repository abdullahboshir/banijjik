import type { ReactElement, ReactNode } from "react";

export interface StickyActionBarProps {
  /** The buttons for the record's current state. */
  children: ReactNode;
  /** Accessible name of the group of actions. */
  label: string;
}

/**
 * The action bar at the bottom of a detail page (13-UX section 4.2). Below the lg breakpoint it sits
 * just above the bottom navigation (3.5 rem tall), from lg up at the bottom of the screen.
 */
export function StickyActionBar({ children, label }: StickyActionBarProps): ReactElement {
  return (
    <div
      role="group"
      aria-label={label}
      className="sticky bottom-14 z-sticky -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-default bg-surface p-4 md:-mx-6 md:px-6 lg:bottom-0"
    >
      {children}
    </div>
  );
}
