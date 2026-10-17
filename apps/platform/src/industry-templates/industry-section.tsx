"use client";

import type { ReactElement, ReactNode } from "react";

/** One collapsible part of the template editor. Open by default so a phone can reach the fields. */
export function IndustrySection({
  title,
  help,
  children,
}: {
  title: string;
  /** One sentence on what this part of the template decides. */
  help: string;
  children: ReactNode;
}): ReactElement {
  return (
    <details open className="rounded-md border border-default bg-surface p-4 shadow-sm">
      <summary className="min-h-11 cursor-pointer text-title font-semibold text-primary">
        {title}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-small text-secondary">{help}</p>
        {children}
      </div>
    </details>
  );
}
