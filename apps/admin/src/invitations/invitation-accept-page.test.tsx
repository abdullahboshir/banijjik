// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const previewFetch = vi.fn();
const sessionFetch = vi.fn();
vi.mock("../lib/api/server-api-fetch", () => ({
  serverPublicApiFetch: (...args: unknown[]) => previewFetch(...args),
  serverApiFetch: (...args: unknown[]) => sessionFetch(...args),
}));
vi.mock("../lib/i18n/get-translator", () => ({
  getTranslator: () => Promise.resolve(banglaTranslator()),
}));
vi.mock("./accept-invitation-button", () => ({
  AcceptInvitationButton: () => <button type="button">গ্রহণ</button>,
}));

const { InvitationAcceptPage } = await import("./invitation-accept-page");

const PREVIEW = {
  organizationName: "আকমি ট্রেডার্স",
  invitedByDisplayName: "রহিম",
  identifierHint: "r***@example.com",
  status: "PENDING",
};

function failure(status: number, code: ApiError["code"]): ApiError {
  return new ApiError({ status, code, messageKey: "errors.not_found" });
}

beforeEach(() => {
  previewFetch.mockReset();
  sessionFetch.mockReset();
});

describe("InvitationAcceptPage", () => {
  it("shows the business, the inviter and the masked identifier, and sign-in links for a visitor", async () => {
    previewFetch.mockResolvedValue({ data: PREVIEW });
    sessionFetch.mockRejectedValue(failure(401, ERROR_CODE.UNAUTHENTICATED));

    render(await InvitationAcceptPage({ token: "the-token" }));

    expect(screen.getByText(/আকমি ট্রেডার্স/)).not.toBeNull();
    expect(screen.getByText(/r\*\*\*@example\.com/)).not.toBeNull();
    const signIn = screen.getByRole("link", { name: banglaText("auth.signIn.submit") });
    expect(decodeURIComponent(signIn.getAttribute("href") ?? "")).toContain(
      "next=/invitations/the-token",
    );
    expect(screen.getByRole("link", { name: banglaText("auth.signUp.submit") })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "গ্রহণ" })).toBeNull();
  });

  it("offers the accept button to a signed-in person and names them", async () => {
    previewFetch.mockResolvedValue({ data: PREVIEW });
    sessionFetch.mockResolvedValue({ data: { name: "করিম" } });

    render(await InvitationAcceptPage({ token: "the-token" }));

    expect(screen.getByRole("button", { name: "গ্রহণ" })).not.toBeNull();
    expect(screen.getByText(/করিম/)).not.toBeNull();
    expect(screen.queryByRole("link", { name: banglaText("auth.signUp.submit") })).toBeNull();
  });

  it("says the invitation is no longer valid for an unknown or used token", async () => {
    previewFetch.mockRejectedValue(failure(404, ERROR_CODE.NOT_FOUND));
    sessionFetch.mockRejectedValue(failure(401, ERROR_CODE.UNAUTHENTICATED));

    render(await InvitationAcceptPage({ token: "gone" }));

    expect(screen.getByText(banglaText("accept.invalid"))).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
