"use client";

import type { ReactElement } from "react";
import { Icon } from "../lib/icons.js";
import { useLinkComponent } from "../lib/link.js";

export interface TopicCardLink {
  href: string;
  label: string;
}

export interface TopicCardProps {
  title: string;
  /** One plain line that names what is inside, such as "Logo, address, language". */
  description: string;
  iconKey: string;
  links: readonly TopicCardLink[];
}

/** One topic of the settings home (ADR-112): an icon, a title, one line of help and the pages inside. */
export function TopicCard({ title, description, iconKey, links }: TopicCardProps): ReactElement {
  const Link = useLinkComponent();
  return (
    <article className="flex flex-col gap-3 rounded-md border border-default bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Icon iconKey={iconKey} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-title font-semibold text-primary">{title}</h2>
          <p className="text-small text-secondary">{description}</p>
        </div>
      </div>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.href} className="border-t border-default first:border-t-0">
            <Link href={link.href} className="flex min-h-11 items-center text-body text-brand">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
