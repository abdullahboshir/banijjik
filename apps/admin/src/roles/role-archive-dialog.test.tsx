// @vitest-environment jsdom
import { I18nProvider } from "@banijjik/web-client/client";
import { ERROR_CODE, ROLE_RULE_KEY } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const archiveRole = vi.fn();
vi.mock("./role-api", () => ({ archiveRole: (...args: unknown[]) => archiveRole(...args) }));

const { RoleArchiveDialog } = await import("./role-archive-dialog");
const { roleArchiveLabelsOf } = await import("./role-labels");

const labels = roleArchiveLabelsOf(banglaTranslator().t, {
  name: "বিক্রয় সহকারী",
  memberCount: 3,
});

function renderDialog(onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <RoleArchiveDialog
        organizationId="org-1"
        roleId="r1"
        version={4}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  archiveRole.mockReset();
  refresh.mockReset();
});

describe("RoleArchiveDialog", () => {
  it("archives with the version it read, then closes and reloads the page", async () => {
    archiveRole.mockResolvedValue({});
    const onClose = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(archiveRole).toHaveBeenCalledWith("org-1", "r1", 4);
  });

  it("says how many members still have the role when it is in use", async () => {
    archiveRole.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.role_in_use",
        details: { ruleKey: ROLE_RULE_KEY.ROLE_IN_USE },
      }),
    );
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    expect(await screen.findByText(labels.inUse)).not.toBeNull();
    expect(labels.inUse).toContain("3");
  });

  it("tells the person someone else changed the role on a 409", async () => {
    archiveRole.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    expect(await screen.findByText(labels.conflict)).not.toBeNull();
  });
});
