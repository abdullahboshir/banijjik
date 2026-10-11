// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "../lib/i18n/i18n-provider";

const acceptInvitation = vi.fn();
vi.mock("../lib/api/organization-api", () => ({
  acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
}));
const signOut = vi.fn();
vi.mock("../auth/sign-out", () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

const { AcceptInvitationButton } = await import("./accept-invitation-button");

const labels = {
  submit: banglaText("accept.submit"),
  invalid: banglaText("accept.invalid"),
  mismatchHint: "গ্রহণ করতে r***@example.com দিয়ে সাইন ইন করুন।",
  switchAccount: banglaText("accept.switchAccount"),
};

function renderButton(): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <QueryClientProvider client={new QueryClient()}>
        <AcceptInvitationButton token="the-token" labels={labels} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

function refusal(code: ApiError["code"], status: number): ApiError {
  return new ApiError({ status, code, messageKey: "errors.not_found" });
}

beforeEach(() => {
  acceptInvitation.mockReset();
  signOut.mockReset();
});

describe("AcceptInvitationButton", () => {
  it("accepts the invitation with the token", async () => {
    acceptInvitation.mockRejectedValue(refusal(ERROR_CODE.NOT_FOUND, 404));
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith("the-token"));
  });

  it("says the invitation is no longer valid on a 404", async () => {
    acceptInvitation.mockRejectedValue(refusal(ERROR_CODE.NOT_FOUND, 404));
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("accept.invalid"));
  });

  it("explains an identifier mismatch and offers to sign out and switch account", async () => {
    acceptInvitation.mockRejectedValue(refusal(ERROR_CODE.FORBIDDEN, 403));
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(banglaText("errors.invitation_identifier_mismatch"));
    expect(alert.textContent).toContain(labels.mismatchHint);
    await userEvent.click(screen.getByRole("button", { name: labels.switchAccount }));
    expect(signOut).toHaveBeenCalledWith(expect.anything(), "/invitations/the-token");
  });
});
