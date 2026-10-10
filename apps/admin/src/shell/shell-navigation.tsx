"use client";

import {
  BottomNav,
  QuickCreateSheet,
  type QuickCreateAction,
  type SidebarGroup,
} from "@banijjik/ui";
import { usePathname } from "next/navigation";
import { useState, type ReactElement } from "react";
import { buildBottomNavSlots, type BottomNavLabels } from "./build-bottom-nav-slots";

export interface ShellNavigationLabels extends BottomNavLabels {
  navLabel: string;
  closeLabel: string;
  emptyText: string;
}

export interface ShellNavigationProps {
  menu: SidebarGroup[];
  orgSlug: string;
  /** Already translated by the server layout; the ui package is text-agnostic. */
  labels: ShellNavigationLabels;
  /** Create actions of effective modules; empty until /me/config is wired (card 1.7). */
  quickCreateActions: QuickCreateAction[];
}

function menuToActions(menu: readonly SidebarGroup[]): QuickCreateAction[] {
  return menu.flatMap((group) =>
    group.entries.map((entry) => ({
      actionKey: entry.menuKey,
      label: entry.label,
      href: entry.href,
      iconKey: entry.iconKey,
    })),
  );
}

/** Mobile navigation: the bottom nav plus the two sheets its Create and More slots open. */
export function ShellNavigation({
  menu,
  orgSlug,
  labels,
  quickCreateActions,
}: ShellNavigationProps): ReactElement {
  const activePath = usePathname();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const slots = buildBottomNavSlots({
    menu,
    orgSlug,
    labels,
    activePath,
    onQuickCreate: () => setIsCreateOpen(true),
    onMore: () => setIsMoreOpen(true),
  });
  return (
    <>
      <BottomNav slots={slots} navLabel={labels.navLabel} />
      <QuickCreateSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={labels.quickCreate}
        actions={quickCreateActions}
        emptyText={labels.emptyText}
        closeLabel={labels.closeLabel}
      />
      <QuickCreateSheet
        open={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        title={labels.more}
        actions={menuToActions(menu)}
        emptyText={labels.emptyText}
        closeLabel={labels.closeLabel}
      />
    </>
  );
}
