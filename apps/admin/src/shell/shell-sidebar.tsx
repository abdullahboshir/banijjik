"use client";

import { Sidebar, type SidebarGroup } from "@banijjik/ui";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { isOnPath } from "./active-path";

export interface ShellSidebarProps {
  groups: SidebarGroup[];
  navLabel: string;
  /** The business's home path: it is active only on that exact page, not on every page below it. */
  homeHref: string;
}

/** The sidebar of the persistent shell: the server sends the groups, the browser marks the current page. */
export function ShellSidebar({ groups, navLabel, homeHref }: ShellSidebarProps): ReactElement {
  const activePath = usePathname();
  const markedGroups = groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => ({
      ...entry,
      isActive:
        entry.href === homeHref ? activePath === homeHref : isOnPath(activePath, entry.href),
    })),
  }));
  return <Sidebar groups={markedGroups} navLabel={navLabel} />;
}
