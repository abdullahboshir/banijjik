import { SURFACE, type MenuEntry } from "@banijjik/contracts";
import { createTranslator, SCREEN_CATALOGS } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { buildMenuGroups } from "./menu-groups";
import { buildBottomNavSlots } from "./build-bottom-nav-slots";

const { t } = createTranslator({ locale: "bn", brandName: "Example", catalogs: SCREEN_CATALOGS });

function entry(menuKey: string, groupKey: string, order: number, path: string): MenuEntry {
  return {
    menuKey,
    surface: SURFACE.ADMIN,
    groupKey,
    labelTermKey: `menu.${menuKey}`,
    path,
    iconKey: "settings",
    permissionKey: "organization.member.read",
    order,
  };
}

const staff = entry("organization.staff", "settings", 30, "settings/staff");
const profile = entry("organization.profile", "settings", 10, "settings/profile");

describe("buildMenuGroups", () => {
  it("builds no group at all for an empty menu, so the shell has no sidebar", () => {
    expect(buildMenuGroups({ menu: [], orgSlug: "acme", terms: {}, t })).toEqual([]);
  });

  it("orders groups by the catalog and entries by order, with Home first", () => {
    const groups = buildMenuGroups({ menu: [staff, profile], orgSlug: "acme", terms: {}, t });
    expect(groups.map((group) => group.groupKey)).toEqual(["home", "settings"]);
    expect(groups[0]?.entries[0]?.href).toBe("/acme");
    expect(groups[1]?.entries.map((item) => item.menuKey)).toEqual([
      "organization.profile",
      "organization.staff",
    ]);
    expect(groups[1]?.entries[0]?.href).toBe("/acme/settings/profile");
  });

  it("labels entries from the business's terms first, then the catalog key", () => {
    const [, settings] = buildMenuGroups({
      menu: [{ ...staff, labelTermKey: "menu.organization.staff" }],
      orgSlug: "acme",
      terms: {},
      t,
    });
    expect(settings?.entries[0]?.label).toBe("কর্মী ও ভূমিকা");
    const [, overridden] = buildMenuGroups({
      menu: [{ ...staff, labelTermKey: "menu.organization.staff" }],
      orgSlug: "acme",
      terms: { "menu.organization.staff": "টিম" },
      t,
    });
    expect(overridden?.entries[0]?.label).toBe("টিম");
  });

  it("feeds the bottom nav: Home and More are always there, entries reach the More list", () => {
    const groups = buildMenuGroups({ menu: [staff], orgSlug: "acme", terms: {}, t });
    const slots = buildBottomNavSlots({
      menu: groups,
      orgSlug: "acme",
      labels: { home: "হোম", quickCreate: "নতুন", more: "আরও" },
    });
    expect(slots.map((slot) => slot.slotKey)).toEqual(["home", "quickCreate", "more"]);
  });
});
