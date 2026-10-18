// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { CustomerAccountResponse } from "@banijjik/contracts/contact";
import { BUNDLED_CATALOGS, createTranslator } from "@banijjik/i18n";
import { SCREEN_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const changeWebsiteLogin = vi.fn();
vi.mock("./website-login-api", () => ({
  changeWebsiteLogin: (...args: unknown[]) => changeWebsiteLogin(...args),
}));

const { WebsiteLoginSection } = await import("./website-login-section");

const ACCOUNT: CustomerAccountResponse = {
  customerAccountId: "account-1",
  contactId: "contact-1",
  status: "ACTIVE",
  verifiedAt: "2026-10-01T08:00:00.000Z",
  lastLoginAt: "2026-10-17T08:00:00.000Z",
  blockedAt: null,
  version: 4,
};

const translator = createTranslator({
  locale: "en",
  catalogs: { en: { ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en } },
  brandName: "Example",
});

function inProvider(node: ReactNode): ReactElement {
  return (
    <I18nProvider
      locale="en"
      catalog={{ ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en }}
      brandName="Example"
    >
      {node}
    </I18nProvider>
  );
}

function renderSection(account: CustomerAccountResponse | undefined, canBlock = true) {
  render(
    inProvider(
      <WebsiteLoginSection
        organizationId="org-1"
        contactId="contact-1"
        account={account}
        canBlock={canBlock}
        translator={translator}
        timeZone="Asia/Dhaka"
      />,
    ),
  );
}

beforeEach(() => {
  changeWebsiteLogin.mockReset();
  refresh.mockReset();
});

describe("WebsiteLoginSection", () => {
  it("says so when the contact never signed in, and offers no action", () => {
    renderSection(undefined);

    expect(screen.getByText("Has not signed in to the website yet.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an active login with its dates and a Block button", () => {
    renderSection(ACCOUNT);

    expect(screen.getByText("Can sign in")).toBeTruthy();
    expect(screen.getByText("Oct 17, 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Block login" })).toBeTruthy();
  });

  it("shows a blocked login with an Unblock button", () => {
    renderSection({ ...ACCOUNT, status: "BLOCKED", blockedAt: "2026-10-18T08:00:00.000Z" });

    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unblock login" })).toBeTruthy();
  });

  it("hides the button from a person who may not block", () => {
    renderSection(ACCOUNT, false);

    expect(screen.getByText("Can sign in")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks first, then blocks with the version it read and reloads the page", async () => {
    changeWebsiteLogin.mockResolvedValue({});
    renderSection(ACCOUNT);

    await userEvent.click(screen.getByRole("button", { name: "Block login" }));
    await screen.findByText("Block website login?");
    expect(changeWebsiteLogin).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: "Block login" }).pop();
    await userEvent.click(confirm as HTMLElement);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(changeWebsiteLogin).toHaveBeenCalledWith("org-1", "contact-1", {
      change: "block",
      version: 4,
    });
  });

  it("explains a stale version instead of closing", async () => {
    changeWebsiteLogin.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSection(ACCOUNT);

    await userEvent.click(screen.getByRole("button", { name: "Block login" }));
    await screen.findByText("Block website login?");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Block login" }).pop() as HTMLElement,
    );

    expect(await screen.findByText(/Someone else changed this just now/)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
