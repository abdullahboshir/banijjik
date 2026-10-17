import type { ReactElement, ReactNode } from "react";

export interface PageLayoutProps {
  /** The one h1 of the page. */
  title: string;
  /** One plain sentence under the title that says what the page is for. */
  subtitle?: string;
  /** The primary action (and any secondary ones) of the page. */
  actions?: ReactNode;
  /** A filter bar or chips shown between the title and the content. */
  filters?: ReactNode;
  children?: ReactNode;
}

/**
 * The one layout of every admin and platform page (13-UX section 3.1, ADR-112): a title with an optional
 * line of help, the primary action on the same row, optional filters, then the page's sections.
 */
export function PageLayout({
  title,
  subtitle,
  actions,
  filters,
  children,
}: PageLayoutProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="min-w-0 break-words text-display font-semibold text-primary md:text-display-lg">
              {title}
            </h1>
            {subtitle ? <p className="text-body text-secondary">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {filters}
      </header>
      {children}
    </div>
  );
}
