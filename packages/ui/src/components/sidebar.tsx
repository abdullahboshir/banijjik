"use client";

import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { Icon } from "../lib/icons.js";
import { useLinkComponent } from "../lib/link.js";

export interface SidebarEntry {
  menuKey: string;
  label: string;
  href: string;
  iconKey: string;
  isActive: boolean;
}

export interface SidebarGroup {
  groupKey: string;
  label: string;
  entries: SidebarEntry[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  /** Accessible name of the navigation landmark. */
  navLabel: string;
  /** Icons only between the lg and xl breakpoints, labels from xl (13-UX section 3). Default true. */
  collapsedAt1024?: boolean;
}

function SidebarEntryLink({
  entry,
  isCollapsible,
}: {
  entry: SidebarEntry;
  isCollapsible: boolean;
}): ReactElement {
  const Link = useLinkComponent();
  const labelClass = isCollapsible ? "lg:sr-only xl:not-sr-only" : undefined;
  return (
    <Link
      href={entry.href}
      aria-current={entry.isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-body text-primary transition-colors hover:bg-subtle",
        entry.isActive && "bg-subtle font-semibold text-brand",
      )}
    >
      <Icon iconKey={entry.iconKey} className="size-5 shrink-0" />
      <span className={labelClass}>{entry.label}</span>
    </Link>
  );
}

export function Sidebar({ groups, navLabel, collapsedAt1024 = true }: SidebarProps): ReactElement {
  const visibleGroups = groups.filter((group) => group.entries.length > 0);
  return (
    <nav
      aria-label={navLabel}
      className={cn(
        "sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 overflow-y-auto border-r border-default bg-surface p-3",
        collapsedAt1024 ? "lg:w-18 xl:w-64" : "lg:w-64",
      )}
    >
      {visibleGroups.map((group) => (
        <section key={group.groupKey} aria-label={group.label} className="mb-4">
          <h2
            className={cn(
              "px-3 pb-1 text-caption text-secondary",
              collapsedAt1024 && "lg:sr-only xl:not-sr-only",
            )}
          >
            {group.label}
          </h2>
          <ul className="flex flex-col gap-1">
            {group.entries.map((entry) => (
              <li key={entry.menuKey}>
                <SidebarEntryLink entry={entry} isCollapsible={collapsedAt1024} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
