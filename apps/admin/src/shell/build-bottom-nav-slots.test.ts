import type { SidebarGroup } from "@banijjik/ui";
import { describe, expect, it } from "vitest";
import { buildBottomNavSlots } from "./build-bottom-nav-slots";

const labels = { home: "Home", quickCreate: "Create new", more: "More" };

function menuWith(...menuKeys: string[]): SidebarGroup[] {
  return [
    {
      groupKey: "main",
      label: "Main",
      entries: menuKeys.map((menuKey) => ({
        menuKey,
        label: menuKey,
        href: `/shop/${menuKey}`,
        iconKey: "package",
        isActive: false,
      })),
    },
  ];
}

describe("buildBottomNavSlots", () => {
  it("shows Home, Quick create and More when the menu is empty", () => {
    const slots = buildBottomNavSlots({ menu: [], orgSlug: "shop", labels });
    expect(slots.map((slot) => slot.slotKey)).toEqual(["home", "quickCreate", "more"]);
    expect(slots[0]?.href).toBe("/shop");
  });

  it("returns 5 slots in the 13-UX order when orders and catalog entries exist", () => {
    const slots = buildBottomNavSlots({
      menu: menuWith("orders", "offerings"),
      orgSlug: "shop",
      labels,
    });
    expect(slots.map((slot) => slot.slotKey)).toEqual([
      "home",
      "orders",
      "quickCreate",
      "offerings",
      "more",
    ]);
  });

  it("prefers the inbox over orders for the Work tab", () => {
    const slots = buildBottomNavSlots({
      menu: menuWith("orders", "inbox"),
      orgSlug: "shop",
      labels,
    });
    expect(slots[1]?.slotKey).toBe("inbox");
  });

  it("marks the slot of the current path as active", () => {
    const slots = buildBottomNavSlots({
      menu: menuWith("orders"),
      orgSlug: "shop",
      labels,
      activePath: "/shop/orders/42",
    });
    expect(slots.find((slot) => slot.slotKey === "orders")?.isActive).toBe(true);
    expect(slots.find((slot) => slot.slotKey === "home")?.isActive).toBe(false);
  });

  it("attaches the select handlers to Quick create and More only", () => {
    const slots = buildBottomNavSlots({
      menu: [],
      orgSlug: "shop",
      labels,
      onQuickCreate: () => undefined,
      onMore: () => undefined,
    });
    expect(slots.map((slot) => slot.onSelect !== undefined)).toEqual([false, true, true]);
  });
});
