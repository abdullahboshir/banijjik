import { SETTINGS_TOPIC, SURFACE, type MenuEntry } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { groupSettingsTopics } from "./settings-topics";

function settingsEntry(menuKey: string, order: number, topic?: MenuEntry["settingsTopicKey"]) {
  return {
    menuKey,
    surface: SURFACE.ADMIN,
    groupKey: "settings",
    labelTermKey: `menu.${menuKey}`,
    path: `settings/${menuKey}`,
    iconKey: "settings",
    permissionKey: "organization.profile.update",
    order,
    ...(topic ? { settingsTopicKey: topic } : {}),
  } satisfies MenuEntry;
}

describe("groupSettingsTopics", () => {
  it("groups the pages by topic, in the topic catalog order", () => {
    const groups = groupSettingsTopics([
      settingsEntry("fields", 80, SETTINGS_TOPIC.ADVANCED),
      settingsEntry("staff", 30, SETTINGS_TOPIC.TEAM),
      settingsEntry("profile", 10, SETTINGS_TOPIC.BUSINESS),
      settingsEntry("roles", 40, SETTINGS_TOPIC.TEAM),
    ]);
    expect(groups.map((group) => group.topic)).toEqual(["BUSINESS", "TEAM", "ADVANCED"]);
    expect(groups[1]?.entries.map((entry) => entry.menuKey)).toEqual(["staff", "roles"]);
  });

  it("hides a topic that has no page, so Website, Sales, Payments and Automation stay out until a module adds one", () => {
    const groups = groupSettingsTopics([settingsEntry("profile", 10, SETTINGS_TOPIC.BUSINESS)]);
    expect(groups.map((group) => group.topic)).toEqual(["BUSINESS"]);
  });

  it("shows fewer topics when the person may open fewer pages", () => {
    const ownerMenu = [
      settingsEntry("profile", 10, SETTINGS_TOPIC.BUSINESS),
      settingsEntry("staff", 30, SETTINGS_TOPIC.TEAM),
      settingsEntry("modules", 70, SETTINGS_TOPIC.ADVANCED),
    ];
    const staffMenu = ownerMenu.filter((entry) => entry.menuKey === "profile");
    expect(groupSettingsTopics(ownerMenu)).toHaveLength(3);
    expect(groupSettingsTopics(staffMenu)).toHaveLength(1);
  });

  it("returns nothing for an empty menu and ignores a page that names no topic", () => {
    expect(groupSettingsTopics([])).toEqual([]);
    expect(groupSettingsTopics([settingsEntry("orders", 10)])).toEqual([]);
  });
});
