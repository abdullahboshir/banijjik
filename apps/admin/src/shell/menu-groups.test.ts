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
    expect(buildMenuGroups({ menu: [], orgSlug: "acme", terms: {}, locale: "bn", t })).toEqual([]);
  });

  it("orders groups by the catalog and entries by order, with Home first", () => {
    const groups = buildMenuGroups({
      menu: [staff, profile],
      orgSlug: "acme",
      terms: {},
      locale: "bn",
      t,
    });
    expect(groups.map((group) => group.groupKey)).toEqual(["home", "settings"]);
    expect(groups[0]?.entries[0]?.href).toBe("/acme");
    expect(groups[1]?.entries.map((item) => item.menuKey)).toEqual([
      "organization.profile",
      "organization.staff",
    ]);
    expect(groups[1]?.entries[0]?.href).toBe("/acme/settings/profile");
  });

  describe("labels", () => {
    const locations = {
      ...staff,
      menuKey: "organization.locations",
      labelTermKey: "menu.organization.locations",
      termKey: "location",
    };
    const OUTLET = { location: { bn: "আউটলেট", en: "Outlet" } };

    function labelOf(options: {
      entry: typeof staff;
      terms: Parameters<typeof buildMenuGroups>[0]["terms"];
      locale: "bn" | "en";
    }): string | undefined {
      const groups = buildMenuGroups({ menu: [options.entry], orgSlug: "acme", ...options, t });
      return groups[1]?.entries[0]?.label;
    }

    it("shows the business's word for an entry named after a term, in the user's language", () => {
      expect(labelOf({ entry: locations, terms: OUTLET, locale: "bn" })).toBe("আউটলেট");
      expect(labelOf({ entry: locations, terms: OUTLET, locale: "en" })).toBe("Outlet");
    });

    it("shows the catalog message when the business has no such term or no text in that language", () => {
      expect(labelOf({ entry: locations, terms: {}, locale: "bn" })).toBe("শাখা");
      expect(
        labelOf({ entry: locations, terms: { location: { en: "Outlet" } }, locale: "bn" }),
      ).toBe("শাখা");
    });

    it("shows the catalog message for an entry without a term key, even if a term shares its message key", () => {
      const withoutTerm = { ...staff, labelTermKey: "menu.organization.staff" };

      expect(
        labelOf({
          entry: withoutTerm,
          terms: { "menu.organization.staff": { bn: "টিম", en: "Team" } },
          locale: "bn",
        }),
      ).toBe("কর্মী ও ভূমিকা");
    });
  });

  it("feeds the bottom nav: Home and More are always there, entries reach the More list", () => {
    const groups = buildMenuGroups({ menu: [staff], orgSlug: "acme", terms: {}, locale: "bn", t });
    const slots = buildBottomNavSlots({
      menu: groups,
      orgSlug: "acme",
      labels: { home: "হোম", quickCreate: "নতুন", more: "আরও" },
    });
    expect(slots.map((slot) => slot.slotKey)).toEqual(["home", "quickCreate", "more"]);
  });
});
