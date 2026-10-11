// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ApiError } from "@banijjik/web-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, renderInBangla } from "../test-support/render-helpers";

const { replace, login } = vi.hoisted(() => ({ replace: vi.fn(), login: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../api/platform-api", () => ({ login }));

const { SignInForm } = await import("./sign-in-form");

async function fillAndSubmit(identifier: string, password: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(banglaText("auth.field.identifier"), { exact: false }),
    identifier,
  );
  await user.type(
    screen.getByLabelText(banglaText("auth.field.password"), { exact: false }),
    password,
  );
  await user.click(screen.getByRole("button", { name: banglaText("auth.signIn.submit") }));
}

beforeEach(() => {
  replace.mockReset();
  login.mockReset();
});

describe("SignInForm", () => {
  it("asks for both fields and does not call the API when they are empty", async () => {
    renderInBangla(<SignInForm nextPath="/" />);
    await userEvent.click(screen.getByRole("button", { name: banglaText("auth.signIn.submit") }));
    // The schema loads on the first submit, so the messages arrive a moment later.
    expect(await screen.findByText(banglaText("validation.identifier_required"))).not.toBeNull();
    expect(await screen.findByText(banglaText("validation.required"))).not.toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in and goes to the page that was asked for", async () => {
    login.mockResolvedValue({});
    renderInBangla(<SignInForm nextPath="/tenants" />);
    await fillAndSubmit("operator@example.com", "correct-horse-battery");
    expect(login).toHaveBeenCalledWith({
      identifier: "operator@example.com",
      password: "correct-horse-battery",
    });
    expect(replace).toHaveBeenCalledWith("/tenants");
  });

  it("never sends the person to another site, whatever next says", async () => {
    login.mockResolvedValue({});
    renderInBangla(<SignInForm nextPath="//evil.example" />);
    await fillAndSubmit("operator@example.com", "correct-horse-battery");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the refusal of a business account in the message of the API and stays on the page", async () => {
    login.mockRejectedValue(
      new ApiError({
        status: 401,
        code: "UNAUTHENTICATED",
        messageKey: "errors.invalid_credentials",
      }),
    );
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("owner@example.com", "correct-horse-battery");
    expect(await screen.findByText(banglaText("errors.invalid_credentials"))).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the wait of a rate limit", async () => {
    login.mockRejectedValue(
      new ApiError({
        status: 429,
        code: "RATE_LIMITED",
        messageKey: "errors.rate_limited",
        retryAfterSeconds: 120,
      }),
    );
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("operator@example.com", "correct-horse-battery");
    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("2");
  });
});
