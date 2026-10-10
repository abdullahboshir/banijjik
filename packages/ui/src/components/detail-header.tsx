"use client";

import type { ReactElement, ReactNode } from "react";
import { useLinkComponent } from "../lib/link.js";

export interface DetailHeaderProps {
  title: string;
  /** Where the back link goes (the list this record came from). */
  backHref: string;
  /** Visible text of the back link, already translated. */
  backLabel: string;
  /** A StatusBadge or similar, shown next to the key facts. */
  status?: ReactNode;
  /** Key facts under the title, such as a phone number or a job title. */
  facts?: ReactNode;
}

/** Top of a detail page (13-UX section 4.2): a back link, the record's number or name, its status and key facts. */
export function DetailHeader({
  title,
  backHref,
  backLabel,
  status,
  facts,
}: DetailHeaderProps): ReactElement {
  const Link = useLinkComponent();
  return (
    <header className="mb-4 flex flex-col gap-2">
      <Link href={backHref} className="inline-flex min-h-11 items-center text-body text-brand">
        {backLabel}
      </Link>
      <h1 className="min-w-0 break-words text-display font-semibold text-primary md:text-display-lg">
        {title}
      </h1>
      {status || facts ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-secondary">
          {status}
          {facts}
        </div>
      ) : null}
    </header>
  );
}
