"use client";

import { BottomNav, Sidebar, type SidebarGroup } from "@banijjik/ui";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import type { NavigationEntry } from "./navigation-entries";

export interface PanelNavigationProps {
  entries: NavigationEntry[];
  /** Accessible name of the navigation landmark and the heading of the one menu group. */
  navLabel: string;
}

/** True when the current path is the entry's page or a page below it. */
function isOnPath(activePath: string, href: string): boolean {
  return activePath === href || activePath.startsWith(`${href}/`);
}

/** The left sidebar from the lg breakpoint; icon-only between lg and xl (13-UX section 3). */
export function PanelSidebar({ entries, navLabel }: PanelNavigationProps): ReactElement {
  const activePath = usePathname();
  const groups: SidebarGroup[] = [
    {
      groupKey: "platform",
      label: navLabel,
      entries: entries.map((entry) => ({ ...entry, isActive: isOnPath(activePath, entry.href) })),
    },
  ];
  return <Sidebar groups={groups} navLabel={navLabel} />;
}

/** Below lg the same entries sit in the bottom bar, so a phone can still reach every page. */
export function PanelBottomNav({ entries, navLabel }: PanelNavigationProps): ReactElement {
  const activePath = usePathname();
  const slots = entries.map((entry) => ({
    slotKey: entry.menuKey,
    label: entry.label,
    href: entry.href,
    iconKey: entry.iconKey,
    isActive: isOnPath(activePath, entry.href),
  }));
  return <BottomNav slots={slots} navLabel={navLabel} />;
}
