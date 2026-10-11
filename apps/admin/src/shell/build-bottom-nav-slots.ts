import { isOnPath } from "./active-path";
import { QUICK_CREATE_SLOT_KEY, type BottomNavSlot, type SidebarGroup } from "@banijjik/ui";

/**
 * Menu keys that can fill the Work tab, strongest first (13-UX section 3). The first one present in the
 * resolved menu wins, so the tab follows the org's config and never the industry (ADR-033).
 */
export const WORK_TAB_MENU_KEYS = ["inbox", "orders", "bookings", "enrollments"] as const;
export const CATALOG_MENU_KEY = "offerings";

export interface BottomNavLabels {
  home: string;
  quickCreate: string;
  more: string;
}

export interface BuildBottomNavSlotsOptions {
  menu: readonly SidebarGroup[];
  orgSlug: string;
  labels: BottomNavLabels;
  /** Current pathname, used for the active state. */
  activePath?: string;
  onQuickCreate?: () => void;
  onMore?: () => void;
}

type MenuEntry = SidebarGroup["entries"][number];

function findEntry(menu: readonly SidebarGroup[], menuKey: string): MenuEntry | undefined {
  return menu.flatMap((group) => group.entries).find((entry) => entry.menuKey === menuKey);
}

function entrySlot(entry: MenuEntry, activePath: string | undefined): BottomNavSlot {
  return {
    slotKey: entry.menuKey,
    label: entry.label,
    href: entry.href,
    iconKey: entry.iconKey,
    isActive: isOnPath(activePath, entry.href),
  };
}

function findWorkEntry(menu: readonly SidebarGroup[]): MenuEntry | undefined {
  for (const menuKey of WORK_TAB_MENU_KEYS) {
    const entry = findEntry(menu, menuKey);
    if (entry) return entry;
  }
  return undefined;
}

function withSelect(slot: BottomNavSlot, onSelect: (() => void) | undefined): BottomNavSlot {
  return onSelect ? { ...slot, onSelect } : slot;
}

/** Pure: resolved menu in, the 3 to 5 slots of 13-UX section 3 out (Home, Work, Create, Catalog, More). */
export function buildBottomNavSlots(options: BuildBottomNavSlotsOptions): BottomNavSlot[] {
  const { menu, orgSlug, labels, activePath } = options;
  const homeHref = `/${orgSlug}`;
  const workEntry = findWorkEntry(menu);
  const catalogEntry = findEntry(menu, CATALOG_MENU_KEY);
  const slots: (BottomNavSlot | undefined)[] = [
    {
      slotKey: "home",
      label: labels.home,
      href: homeHref,
      iconKey: "house",
      isActive: activePath === homeHref,
    },
    workEntry && entrySlot(workEntry, activePath),
    withSelect(
      { slotKey: QUICK_CREATE_SLOT_KEY, label: labels.quickCreate, iconKey: "plus" },
      options.onQuickCreate,
    ),
    catalogEntry && entrySlot(catalogEntry, activePath),
    withSelect({ slotKey: "more", label: labels.more, iconKey: "menu" }, options.onMore),
  ];
  return slots.filter((slot): slot is BottomNavSlot => slot !== undefined);
}
