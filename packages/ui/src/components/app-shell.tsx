import type { ReactElement, ReactNode } from "react";

export interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  bottomNav: ReactNode;
  /** False when the menu is empty: the sidebar column is then not rendered at all. Defaults to true. */
  hasSidebar?: boolean;
  children: ReactNode;
}

/**
 * The sidebar shows from the lg breakpoint and the bottom nav below it. Both are plain CSS visibility, so
 * server and client render the same tree and there is no hydration mismatch.
 */
export function AppShell({
  topBar,
  sidebar,
  bottomNav,
  hasSidebar = true,
  children,
}: AppShellProps): ReactElement {
  return (
    <div className="min-h-dvh bg-app text-primary">
      {topBar}
      <div className="lg:flex">
        {hasSidebar ? <div className="hidden lg:block">{sidebar}</div> : null}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 lg:pb-6">{children}</main>
      </div>
      <div className="lg:hidden">{bottomNav}</div>
    </div>
  );
}
