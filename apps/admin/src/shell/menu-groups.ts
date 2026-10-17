import { SURFACE, type MenuEntry, type PreferredLocale } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import type { SidebarGroup } from "@banijjik/ui";
import { termLabel, type TermTexts } from "@banijjik/web-client";

/** Admin groups in the order of 10-MODULE-CATALOG section 6; a group the list does not know goes last. */
export const MENU_GROUP_ORDER: readonly string[] = [
  "home",
  "sales",
  "bookings",
  "enrollments",
  "catalog",
  "contacts",
  "inbox",
  "website",
  "money",
  "reports",
  "settings",
];

const HOME_GROUP_KEY = "home";
const HOME_MENU_KEY = "home";
const HOME_ICON_KEY = "house";
export const SETTINGS_GROUP_KEY = "settings";
const SETTINGS_ICON_KEY = "settings";
const SETTINGS_HOME_MENU_KEY = "settings.home";

export interface MenuGroupOptions {
  menu: readonly MenuEntry[];
  orgSlug: string;
  /** Resolved terms (`config.terms`). A missing key or language falls back to the catalog. */
  terms: TermTexts;
  locale: PreferredLocale;
  t: Translator["t"];
}

function groupRank(groupKey: string): number {
  const index = MENU_GROUP_ORDER.indexOf(groupKey);
  return index === -1 ? MENU_GROUP_ORDER.length : index;
}

function byOrderThenKey(left: MenuEntry, right: MenuEntry): number {
  return left.order - right.order || left.menuKey.localeCompare(right.menuKey, "en");
}

function byGroupRankThenKey(left: SidebarGroup, right: SidebarGroup): number {
  return (
    groupRank(left.groupKey) - groupRank(right.groupKey) ||
    left.groupKey.localeCompare(right.groupKey, "en")
  );
}

/** The settings home of a business: one card per topic. */
export function settingsHomeHref(orgSlug: string): string {
  return `/${orgSlug}/settings`;
}

/** A menu path is relative to the business (`settings/staff`); the leading slash of a probe path is tolerated. */
function hrefOf(orgSlug: string, path: string): string {
  return `/${orgSlug}/${path.replace(/^\/+/, "")}`;
}

/** An entry named after a term shows the business's word for it; any other entry, or a missing term, shows the catalog message. */
export function menuEntryLabelOf(
  entry: MenuEntry,
  context: Pick<MenuGroupOptions, "terms" | "locale" | "t">,
): string {
  const message = context.t(entry.labelTermKey);
  if (entry.termKey === undefined) return message;
  return termLabel(context.terms, entry.termKey, { locale: context.locale, fallback: message });
}

function toSidebarGroups(options: MenuGroupOptions): SidebarGroup[] {
  const { menu, orgSlug, terms, locale, t } = options;
  const groups = new Map<string, SidebarGroup>();
  for (const entry of menu.filter((candidate) => candidate.surface === SURFACE.ADMIN)) {
    const group = groups.get(entry.groupKey) ?? {
      groupKey: entry.groupKey,
      label: t(`menu.group.${entry.groupKey}`),
      entries: [],
    };
    group.entries.push({
      menuKey: entry.menuKey,
      label: menuEntryLabelOf(entry, { terms, locale, t }),
      href: hrefOf(orgSlug, entry.path),
      iconKey: entry.iconKey,
      isActive: false,
    });
    groups.set(entry.groupKey, group);
  }
  return [...groups.values()].sort(byGroupRankThenKey);
}

/** Entries are placed in the server's order (`order`, then key); sorting here keeps the helper correct on its own. */
function sortedMenu(menu: readonly MenuEntry[]): MenuEntry[] {
  return [...menu].sort(byOrderThenKey);
}

/** The settings group opens with a link to the settings home, so every page below it is reached by topic (ADR-112). */
function addSettingsHome(groups: SidebarGroup[], options: MenuGroupOptions): void {
  const settingsGroup = groups.find((group) => group.groupKey === SETTINGS_GROUP_KEY);
  if (!settingsGroup) return;
  settingsGroup.entries.unshift({
    menuKey: SETTINGS_HOME_MENU_KEY,
    label: options.t("nav.settingsHome"),
    href: settingsHomeHref(options.orgSlug),
    iconKey: SETTINGS_ICON_KEY,
    isActive: false,
  });
}

/**
 * The sidebar and bottom-nav menu: groups in catalog order, empty groups left out, labels from the
 * business's terms first and the catalog default key after. A business with any menu entry also gets
 * Home as the first entry of the home group and the settings home as the first entry of the settings
 * group; one with none gets no sidebar at all.
 */
export function buildMenuGroups(options: MenuGroupOptions): SidebarGroup[] {
  const groups = toSidebarGroups({ ...options, menu: sortedMenu(options.menu) });
  if (groups.length === 0) return groups;
  addSettingsHome(groups, options);
  const homeEntry = {
    menuKey: HOME_MENU_KEY,
    label: options.t("nav.home"),
    href: `/${options.orgSlug}`,
    iconKey: HOME_ICON_KEY,
    isActive: false,
  };
  const homeGroup = groups.find((group) => group.groupKey === HOME_GROUP_KEY);
  if (homeGroup) {
    homeGroup.entries.unshift(homeEntry);
    return groups;
  }
  return [
    { groupKey: HOME_GROUP_KEY, label: options.t("menu.group.home"), entries: [homeEntry] },
    ...groups,
  ];
}
