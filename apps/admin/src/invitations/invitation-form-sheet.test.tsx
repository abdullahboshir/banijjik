// @vitest-environment jsdom
import { I18nProvider } from "@banijjik/web-client/client";
import { ApiError } from "../lib/api/api-error";
import { ERROR_CODE } from "@banijjik/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createInvitation = vi.fn();
vi.mock("../lib/api/organization-api", () => ({
  createInvitation: (...args: unknown[]) => createInvitation(...args),
}));

const { InvitationFormSheet } = await import("./invitation-form-sheet");
const { assignmentLabelsOf } = await import("../staff/staff-labels");
const { SINGLE_LOCATION_OPTIONS, translate } = await import("../staff/test-fixtures");

const labels = {
  title: banglaText("staff.invite"),
  identifier: banglaText("auth.field.identifier"),
  identifierHint: banglaText("auth.field.identifierHint"),
  displayName: banglaText("invite.field.displayName"),
  submit: banglaText("invite.submit"),
  close: banglaText("shell.closeMenu"),
  linkTitle: banglaText("invite.link.title"),
  linkHint: banglaText("invite.link.hint"),
  linkField: banglaText("invite.link.title"),
  copy: banglaText("invite.link.copy"),
  copied: banglaText("invite.link.copied"),
  copyFailed: banglaText("invite.link.copyFailed"),
  done: banglaText("invite.link.done"),
  assignments: assignmentLabelsOf(translate),
};
const TOKEN_PATH = "/invitations/abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq";

function renderSheet(onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <InvitationFormSheet
        organizationId="org-1"
        options={SINGLE_LOCATION_OPTIONS}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
}

async function fillAndSubmit(identifier: string): Promise<void> {
  const field = screen.getByLabelText(new RegExp(labels.identifier));
  await userEvent.clear(field);
  await userEvent.type(field, identifier);
  const role = screen.getByLabelText(labels.assignments.role);
  await userEvent.selectOptions(role, SINGLE_LOCATION_OPTIONS.roles[0]?.roleId ?? "");
  await userEvent.click(screen.getByRole("button", { name: labels.submit }));
}

beforeEach(() => {
  createInvitation.mockReset();
  refresh.mockReset();
});

describe("InvitationFormSheet", () => {
  it("shows the link once with a copy button and the 7 day hint after the invitation is created", async () => {
    createInvitation.mockResolvedValue({ invitationId: "i1", inviteUrlPath: TOKEN_PATH });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderSheet();

    await fillAndSubmit("rahim@example.com");

    const field = (await screen.findByLabelText(labels.linkField)) as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}${TOKEN_PATH}`);
    expect(screen.getByText(labels.linkHint)).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: labels.copy }));
    expect(writeText).toHaveBeenCalledWith(field.value);
    expect(await screen.findByText(labels.copied)).not.toBeNull();
    expect(createInvitation.mock.calls[0]?.[1]).toMatchObject({ email: "rahim@example.com" });
  });

  it("sends a phone number as phone and keeps the key of a retry of the same submit", async () => {
    createInvitation.mockRejectedValue(
      new ApiError({ status: 0, code: ERROR_CODE.INTERNAL, messageKey: "errors.network" }),
    );
    renderSheet();

    await fillAndSubmit("01712345678");
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    await userEvent.click(await screen.findByRole("button", { name: labels.submit }));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(2));

    const [first, second] = createInvitation.mock.calls;
    expect(first?.[1]).toMatchObject({ phone: "01712345678" });
    expect(second?.[2]).toBe(first?.[2]);
  });

  it("uses a new key when the body changed between attempts", async () => {
    createInvitation.mockRejectedValue(
      new ApiError({ status: 0, code: ERROR_CODE.INTERNAL, messageKey: "errors.network" }),
    );
    renderSheet();

    await fillAndSubmit("rahim@example.com");
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    await fillAndSubmit("karim@example.com");
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(2));

    expect(createInvitation.mock.calls[1]?.[2]).not.toBe(createInvitation.mock.calls[0]?.[2]);
  });

  it("puts a duplicate refusal on the identifier field", async () => {
    createInvitation.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.DUPLICATE, messageKey: "errors.duplicate" }),
    );
    renderSheet();
    await fillAndSubmit("rahim@example.com");
    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("errors.duplicate"));
  });

  it("asks for the identifier before calling the API", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));
    expect(createInvitation).not.toHaveBeenCalled();
    expect((await screen.findAllByRole("alert"))[0]?.textContent).toBe(
      banglaText("validation.identifier_required"),
    );
  });
});
