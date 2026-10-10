import type { ReactElement, ReactNode } from "react";

export interface TopBarProps {
  logo: ReactNode;
  organizationName: string;
  actions?: ReactNode;
}

export function TopBar({ logo, organizationName, actions }: TopBarProps): ReactElement {
  return (
    <header className="sticky top-0 z-sticky flex h-14 items-center gap-3 border-b border-default bg-surface px-4">
      <div className="shrink-0">{logo}</div>
      <span className="min-w-0 flex-1 truncate text-title font-semibold text-primary">
        {organizationName}
      </span>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </header>
  );
}
