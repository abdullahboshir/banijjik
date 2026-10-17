import type { ReactElement, ReactNode } from "react";

export interface DashboardFrameProps {
  /** "Good morning, Rahim": the first thing the owner reads. */
  greeting: string;
  subtitle?: string;
  /** The "today" cards; card 3.10 fills this area. */
  children?: ReactNode;
}

/**
 * The frame of a business's home (ADR-112): the greeting, then the area for the day's cards. The
 * subscription banners are drawn by the app shell above every page, so the frame does not repeat them.
 */
export function DashboardFrame({
  greeting,
  subtitle,
  children,
}: DashboardFrameProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="break-words text-display font-semibold text-primary md:text-display-lg">
          {greeting}
        </h1>
        {subtitle ? <p className="text-body text-secondary">{subtitle}</p> : null}
      </header>
      {children ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div> : null}
    </div>
  );
}
