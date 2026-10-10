import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomNav } from "../components/bottom-nav.js";
import { QuickCreateSheet } from "../components/quick-create-sheet.js";
import { Sidebar } from "../components/sidebar.js";
import { LinkComponentProvider, type LinkComponent } from "./link.js";

const RouterLink: LinkComponent = ({ href, className, children, ...rest }) => (
  <a href={href} className={className} data-router-link="true" {...rest}>
    {children}
  </a>
);

const groups = [
  {
    groupKey: "sales",
    label: "বিক্রয়",
    entries: [
      {
        menuKey: "orders",
        label: "অর্ডারসমূহ",
        href: "/shop/orders",
        iconKey: "receipt",
        isActive: true,
      },
    ],
  },
];
const slots = [
  { slotKey: "home", label: "হোম", href: "/shop/home", iconKey: "house", isActive: true },
];
const actions = [
  { actionKey: "order", label: "নতুন অর্ডার", href: "/shop/orders/new", iconKey: "receipt" },
];

describe("link component", () => {
  it("renders a plain anchor by default", () => {
    render(<Sidebar groups={groups} navLabel="মেনু" />);
    const link = screen.getByRole("link", { name: "অর্ডারসমূহ" });
    expect(link.getAttribute("href")).toBe("/shop/orders");
    expect(link.getAttribute("data-router-link")).toBeNull();
  });

  it("uses the provided component in Sidebar and keeps aria-current", () => {
    render(
      <LinkComponentProvider component={RouterLink}>
        <Sidebar groups={groups} navLabel="মেনু" />
      </LinkComponentProvider>,
    );
    const link = screen.getByRole("link", { name: "অর্ডারসমূহ" });
    expect(link.getAttribute("data-router-link")).toBe("true");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("uses the provided component in BottomNav and keeps aria-current", () => {
    render(
      <LinkComponentProvider component={RouterLink}>
        <BottomNav slots={slots} navLabel="মেনু" />
      </LinkComponentProvider>,
    );
    const link = screen.getByRole("link", { name: "হোম" });
    expect(link.getAttribute("data-router-link")).toBe("true");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("uses the provided component in QuickCreateSheet", () => {
    render(
      <LinkComponentProvider component={RouterLink}>
        <QuickCreateSheet
          open
          onOpenChange={() => undefined}
          title="নতুন তৈরি করুন"
          actions={actions}
          emptyText="কিছু নেই"
          closeLabel="বন্ধ করুন"
        />
      </LinkComponentProvider>,
    );
    expect(screen.getByRole("link", { name: "নতুন অর্ডার" }).getAttribute("data-router-link")).toBe(
      "true",
    );
  });
});
