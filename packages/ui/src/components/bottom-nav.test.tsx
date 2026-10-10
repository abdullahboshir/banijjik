import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BottomNav, type BottomNavSlot } from "./bottom-nav.js";

function buildSlots(onQuickCreate: () => void): BottomNavSlot[] {
  return [
    { slotKey: "home", label: "হোম", href: "/shop/home", iconKey: "house" },
    { slotKey: "work", label: "অর্ডার", href: "/shop/orders", iconKey: "receipt", badgeCount: 3 },
    { slotKey: "quickCreate", label: "নতুন তৈরি করুন", iconKey: "plus", onSelect: onQuickCreate },
    { slotKey: "catalog", label: "পণ্যসমূহ", href: "/shop/catalog", iconKey: "package" },
    { slotKey: "more", label: "আরও", href: "/shop/more", iconKey: "menu" },
    { slotKey: "extra", label: "ষষ্ঠ স্লট", href: "/shop/extra", iconKey: "tag" },
  ];
}

describe("BottomNav", () => {
  it("renders at most five slots", () => {
    render(<BottomNav slots={buildSlots(vi.fn())} navLabel="প্রধান মেনু" />);
    expect(screen.getAllByRole("link").length + screen.getAllByRole("button").length).toBe(5);
    expect(screen.queryByText("ষষ্ঠ স্লট")).toBeNull();
  });

  it("calls onSelect when the quick create button is pressed", async () => {
    const onQuickCreate = vi.fn();
    render(<BottomNav slots={buildSlots(onQuickCreate)} navLabel="প্রধান মেনু" />);
    await userEvent.click(screen.getByRole("button", { name: "নতুন তৈরি করুন" }));
    expect(onQuickCreate).toHaveBeenCalledTimes(1);
  });

  it("gives every target an accessible name", () => {
    render(<BottomNav slots={buildSlots(vi.fn())} navLabel="প্রধান মেনু" />);
    const targets = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    for (const target of targets) {
      expect(target.textContent || target.getAttribute("aria-label")).toBeTruthy();
    }
    expect(screen.getByRole("navigation", { name: "প্রধান মেনু" })).not.toBeNull();
  });
});
