import type { ReactElement, ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

export function PageHeader({ title, actions, filters }: PageHeaderProps): ReactElement {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-display font-semibold text-primary md:text-display-lg">
          {title}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {filters}
    </div>
  );
}
