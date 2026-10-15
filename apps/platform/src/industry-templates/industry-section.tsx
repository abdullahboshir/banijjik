"use client";

import type { ReactElement, ReactNode } from "react";

/** One collapsible part of the template editor. Open by default so a phone can reach the fields. */
export function IndustrySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <details open className="rounded-md border border-default p-3">
      <summary className="min-h-11 cursor-pointer text-title font-semibold text-primary">
        {title}
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
