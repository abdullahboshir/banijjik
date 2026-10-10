import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailHeader } from "./detail-header.js";
import { StatusBadge } from "./status-badge.js";
import { StickyActionBar } from "./sticky-action-bar.js";

describe("DetailHeader", () => {
  it("shows the name, the status, the key facts and a back link to the list", () => {
    render(
      <DetailHeader
        title="রহিম উদ্দিন"
        backHref="/acme/settings/staff"
        backLabel="কর্মীদের তালিকায় ফিরুন"
        status={<StatusBadge requestType="ENROLLMENT" status="ACTIVE" label="সক্রিয়" />}
        facts={<span>ম্যানেজার</span>}
      />,
    );
    expect(screen.getByRole("heading", { name: "রহিম উদ্দিন" })).not.toBeNull();
    expect(screen.getByText("সক্রিয়")).not.toBeNull();
    expect(screen.getByText("ম্যানেজার")).not.toBeNull();
    const back = screen.getByRole("link", { name: "কর্মীদের তালিকায় ফিরুন" });
    expect(back.getAttribute("href")).toBe("/acme/settings/staff");
  });

  it("leaves out the facts row when there is neither a status nor a fact", () => {
    const { container } = render(<DetailHeader title="কর্মী" backHref="/x" backLabel="ফিরুন" />);
    expect(container.querySelectorAll("header > div")).toHaveLength(0);
  });
});

describe("StickyActionBar", () => {
  it("groups the actions under an accessible name and keeps them above the bottom navigation", () => {
    render(
      <StickyActionBar label="কর্মীর কাজ">
        <button type="button">স্থগিত করুন</button>
      </StickyActionBar>,
    );
    const group = screen.getByRole("group", { name: "কর্মীর কাজ" });
    expect(screen.getByRole("button", { name: "স্থগিত করুন" })).not.toBeNull();
    expect(group.className).toContain("bottom-14");
    expect(group.className).toContain("lg:bottom-0");
  });
});
