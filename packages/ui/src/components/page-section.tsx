import { useId, type ReactElement, type ReactNode } from "react";

export interface PageSectionProps {
  /** The h2 of the section. */
  title: string;
  /** One sentence that tells a business owner what this section is for. */
  help?: string;
  /** An action that belongs to this section only, such as "Add". */
  action?: ReactNode;
  children: ReactNode;
}

/** A titled block of a page (ADR-112): heading, one line of help, an optional action, then the content. */
export function PageSection({ title, help, action, children }: PageSectionProps): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-title font-semibold text-primary">
            {title}
          </h2>
          {help ? <p className="text-small text-secondary">{help}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
