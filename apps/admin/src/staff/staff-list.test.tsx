// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { StaffList } = await import("./staff-list");

const labels = {
  name: banglaText("staff.column.name"),
  roles: banglaText("staff.column.roles"),
  locations: banglaText("staff.column.locations"),
  status: banglaText("staff.column.status"),
  empty: banglaText("staff.empty"),
};
const rows = [
  {
    memberId: "m1",
    name: "রহিম উদ্দিন",
    roles: "ম্যানেজার",
    locations: "মূল শাখা",
    status: "ACTIVE",
    statusLabel: banglaText("staff.status.active"),
  },
];

describe("StaffList", () => {
  it("shows name, role and status, and the locations column only with several locations", () => {
    const { rerender } = render(
      <StaffList
        rows={rows}
        labels={labels}
        detailBasePath="/acme/settings/staff"
        showLocations={false}
      />,
    );
    expect(screen.getAllByText("রহিম উদ্দিন").length).toBeGreaterThan(0);
    expect(screen.queryByText(labels.locations)).toBeNull();

    rerender(
      <StaffList rows={rows} labels={labels} detailBasePath="/acme/settings/staff" showLocations />,
    );
    expect(screen.getByText(labels.locations)).not.toBeNull();
  });

  it("opens the member when a row is chosen", async () => {
    render(
      <StaffList
        rows={rows}
        labels={labels}
        detailBasePath="/acme/settings/staff"
        showLocations={false}
      />,
    );
    await userEvent.click(screen.getAllByText("রহিম উদ্দিন")[0] as HTMLElement);
    expect(push).toHaveBeenCalledWith("/acme/settings/staff/m1");
  });

  it("shows the empty state when no member matches", () => {
    render(
      <StaffList
        rows={[]}
        labels={labels}
        detailBasePath="/acme/settings/staff"
        showLocations={false}
      />,
    );
    expect(screen.getByText(banglaText("staff.empty"))).not.toBeNull();
  });
});
