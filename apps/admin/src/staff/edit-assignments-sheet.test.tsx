import { I18nProvider } from "@banijjik/web-client/client";
// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateMember = vi.fn();
vi.mock("../lib/api/organization-api", () => ({
  updateMember: (...args: unknown[]) => updateMember(...args),
}));

const { EditAssignmentsSheet } = await import("./edit-assignments-sheet");
const { memberActionLabelsOf } = await import("./staff-labels");
const {
  MULTI_LOCATION_OPTIONS,
  SINGLE_LOCATION_OPTIONS,
  STAFF_ROLE_ID,
  FIRST_LOCATION_ID,
  MANAGER_ROLE_ID,
  translate,
} = await import("./test-fixtures");

const labels = memberActionLabelsOf(translate, "রহিম");
const member = {
  memberId: "m1",
  version: 4,
  assignments: [
    { roleId: STAFF_ROLE_ID, locationId: FIRST_LOCATION_ID },
    { roleId: MANAGER_ROLE_ID, locationId: "ALL" },
  ],
};

function renderSheet(options = MULTI_LOCATION_OPTIONS, onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <EditAssignmentsSheet
        organizationId="org-1"
        member={member}
        options={options}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

function apiError(code: ApiError["code"], status: number, details?: Record<string, unknown>) {
  return new ApiError({ status, code, messageKey: "errors.conflict", details });
}

beforeEach(() => {
  updateMember.mockReset();
  refresh.mockReset();
});

describe("EditAssignmentsSheet", () => {
  it("never offers the owner role to choose", () => {
    renderSheet();
    const firstRole = screen.getAllByLabelText(labels.assignments.role)[0] as HTMLElement;
    const optionNames = within(firstRole)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(optionNames).not.toContain(banglaText("role.owner"));
    expect(optionNames).toContain(banglaText("role.manager"));
  });

  it("sends the changed rows with the version it read, then closes and reloads the page", async () => {
    updateMember.mockResolvedValue({});
    const onClose = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateMember).toHaveBeenCalledWith("org-1", "m1", {
      assignments: member.assignments,
      version: 4,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("hides the location select in a one-location business and sends ALL", async () => {
    updateMember.mockResolvedValue({});
    renderSheet(SINGLE_LOCATION_OPTIONS);
    expect(screen.queryByLabelText(labels.assignments.location)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    await waitFor(() => expect(updateMember).toHaveBeenCalled());
    expect(updateMember.mock.calls[0]?.[2].assignments).toEqual([
      { roleId: STAFF_ROLE_ID, locationId: "ALL" },
      { roleId: MANAGER_ROLE_ID, locationId: "ALL" },
    ]);
  });

  it("shows an API field error on the row it belongs to", async () => {
    updateMember.mockRejectedValue(
      apiError(ERROR_CODE.VALIDATION_ERROR, 400, {
        fields: [{ path: "assignments.1.locationId", messageKey: "validation.invalid_value" }],
      }),
    );
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    const rows = await screen.findAllByRole("group");
    expect(within(rows[1] as HTMLElement).getByRole("alert").textContent).toBe(
      banglaText("validation.invalid_value"),
    );
    expect(within(rows[0] as HTMLElement).queryByRole("alert")).toBeNull();
  });

  it("shows the role refusal on the row that uses the refused role", async () => {
    updateMember.mockRejectedValue(
      apiError(ERROR_CODE.BUSINESS_RULE, 422, {
        ruleKey: "ROLE_NOT_GRANTABLE",
        roleId: MANAGER_ROLE_ID,
      }),
    );
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    const rows = await screen.findAllByRole("group");
    expect(within(rows[1] as HTMLElement).getByRole("alert").textContent).toBe(
      banglaText("errors.role_not_grantable"),
    );
  });

  it("explains a stale version and offers to reload", async () => {
    updateMember.mockRejectedValue(apiError(ERROR_CODE.CONFLICT, 409));
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect((await screen.findByText(labels.conflict)).textContent).toBe(
      banglaText("staff.conflict"),
    );
    await userEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not call the API while a row has no role", async () => {
    renderSheet();
    const firstRole = screen.getAllByLabelText(labels.assignments.role)[0] as HTMLElement;
    await userEvent.selectOptions(firstRole, "");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect(updateMember).not.toHaveBeenCalled();
    expect((await screen.findAllByRole("alert"))[0]?.textContent).toBe(
      banglaText("validation.required"),
    );
  });
});
