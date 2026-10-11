// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../lib/i18n/i18n-provider";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const changeMemberStatus = vi.fn();
vi.mock("../lib/api/organization-api", () => ({
  changeMemberStatus: (...args: unknown[]) => changeMemberStatus(...args),
  updateMember: vi.fn(),
}));

const { MemberActions } = await import("./member-actions");
const { memberActionLabelsOf } = await import("./staff-labels");
const { MULTI_LOCATION_OPTIONS, translate } = await import("./test-fixtures");

const labels = memberActionLabelsOf(translate, "রহিম");
const member = { memberId: "m1", version: 2, assignments: [] };

function renderActions(actions: ("editAssignments" | "suspend" | "reactivate" | "remove")[]) {
  render(
    <I18nProvider locale="bn" brandName="Example">
      <MemberActions
        organizationId="org-1"
        member={member}
        actions={actions}
        options={MULTI_LOCATION_OPTIONS}
        labels={labels}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  changeMemberStatus.mockReset();
  refresh.mockReset();
});

describe("MemberActions", () => {
  it("renders nothing when the person may do nothing", () => {
    renderActions([]);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("shows only the given actions", () => {
    renderActions(["suspend", "remove"]);
    expect(screen.getByRole("button", { name: labels.actions.suspend })).not.toBeNull();
    expect(screen.queryByRole("button", { name: labels.actions.editAssignments })).toBeNull();
  });

  it("asks before suspending, then sends the version it read and reloads the page", async () => {
    changeMemberStatus.mockResolvedValue({});
    renderActions(["suspend"]);
    await userEvent.click(screen.getByRole("button", { name: labels.actions.suspend }));
    expect(await screen.findByText(labels.confirm.suspend.title)).not.toBeNull();
    expect(changeMemberStatus).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === labels.actions.suspend,
    );
    await userEvent.click(confirm as HTMLElement);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(changeMemberStatus).toHaveBeenCalledWith({
      organizationId: "org-1",
      memberId: "m1",
      action: "suspend",
      version: 2,
    });
  });
});
