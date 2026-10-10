import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar, type SidebarGroup } from "./sidebar.js";

const groups: SidebarGroup[] = [
  {
    groupKey: "sales",
    label: "বিক্রয় ও অর্ডার",
    entries: [
      {
        menuKey: "sales.orders",
        label: "অর্ডারসমূহ",
        href: "/shop/orders",
        iconKey: "receipt",
        isActive: true,
      },
      {
        menuKey: "sales.returns",
        label: "রিটার্ন",
        href: "/shop/returns",
        iconKey: "package",
        isActive: false,
      },
    ],
  },
  { groupKey: "bookings", label: "বুকিং", entries: [] },
];

describe("Sidebar", () => {
  it("does not render a group without entries", () => {
    render(<Sidebar groups={groups} navLabel="প্রধান মেনু" />);
    expect(screen.queryByText("বুকিং")).toBeNull();
    expect(screen.getByText("বিক্রয় ও অর্ডার")).not.toBeNull();
  });

  it("marks only the active entry as the current page", () => {
    render(<Sidebar groups={groups} navLabel="প্রধান মেনু" />);
    expect(screen.getByRole("link", { name: "অর্ডারসমূহ" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "রিটার্ন" }).getAttribute("aria-current")).toBeNull();
  });
});
