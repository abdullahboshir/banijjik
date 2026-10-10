import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickCreateSheet, type QuickCreateAction } from "./quick-create-sheet.js";

const actions: QuickCreateAction[] = [
  {
    actionKey: "order",
    label: "নতুন অর্ডার তৈরি করুন",
    href: "/shop/orders/new",
    iconKey: "receipt",
  },
  {
    actionKey: "offering",
    label: "নতুন পণ্য যোগ করুন",
    href: "/shop/catalog/new",
    iconKey: "package",
  },
];

function renderSheet(sheetActions: QuickCreateAction[]) {
  return render(
    <QuickCreateSheet
      open
      onOpenChange={vi.fn()}
      title="নতুন তৈরি করুন"
      actions={sheetActions}
      emptyText="এই মুহূর্তে তৈরি করার মতো কিছু নেই"
      closeLabel="বন্ধ করুন"
    />,
  );
}

describe("QuickCreateSheet", () => {
  it("lists every given action as a link", () => {
    renderSheet(actions);
    expect(screen.getByRole("dialog", { name: "নতুন তৈরি করুন" })).not.toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "নতুন পণ্য যোগ করুন" }).getAttribute("href")).toBe(
      "/shop/catalog/new",
    );
  });

  it("shows the empty text when there are no actions", () => {
    renderSheet([]);
    expect(screen.getByText("এই মুহূর্তে তৈরি করার মতো কিছু নেই")).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
