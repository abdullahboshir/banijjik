import { SETTINGS_TOPIC, SURFACE, type MenuEntry, type SettingsTopic } from "@banijjik/contracts";

export interface SettingsTopicGroup {
  topic: SettingsTopic;
  /** The pages of this topic in the menu's order (`order`, then key). */
  entries: MenuEntry[];
}

function byOrderThenKey(left: MenuEntry, right: MenuEntry): number {
  return left.order - right.order || left.menuKey.localeCompare(right.menuKey, "en");
}

/**
 * Groups the settings pages of the resolved menu by topic for the settings home (ADR-112). Topics come
 * out in the catalog order; a topic with no page the person may open is left out, so a card never
 * promises something the person cannot reach. An entry that names no topic is not a settings page card.
 */
export function groupSettingsTopics(menu: readonly MenuEntry[]): SettingsTopicGroup[] {
  const sorted = menu.filter((entry) => entry.surface === SURFACE.ADMIN).sort(byOrderThenKey);
  return Object.values(SETTINGS_TOPIC)
    .map((topic) => ({
      topic,
      entries: sorted.filter((entry) => entry.settingsTopicKey === topic),
    }))
    .filter((group) => group.entries.length > 0);
}
