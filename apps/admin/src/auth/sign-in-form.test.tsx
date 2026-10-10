// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";
import { banglaText, renderInBangla } from "./test-helpers";

const { replace, login } = vi.hoisted(() => ({ replace: vi.fn(), login: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../lib/api/auth-api", () => ({ login }));

const { SignInForm } = await import("./sign-in-form");

function refusal(status: number, code: string, messageKey: string, retryAfterSeconds?: number) {
  return new ApiError({
    status,
    code: code as ApiError["code"],
    messageKey,
    retryAfterSeconds,
  });
}

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
    expect(screen.getByText(banglaText("validation.identifier_required"))).not.toBeNull();
    expect(screen.getByText(banglaText("validation.required"))).not.toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects an identifier that is neither a phone number nor an email on blur", async () => {
    renderInBangla(<SignInForm nextPath="/" />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(banglaText("auth.field.identifier"), { exact: false }),
      "abc",
    );
    await user.tab();
    expect(screen.getByText(banglaText("validation.invalid_format"))).not.toBeNull();
  });

  it("signs in and goes to the requested page", async () => {
    login.mockResolvedValue({});
    renderInBangla(<SignInForm nextPath="/acme/orders" />);
    await fillAndSubmit("01712345678", "secret-password");
    expect(login).toHaveBeenCalledWith({ identifier: "01712345678", password: "secret-password" });
    expect(replace).toHaveBeenCalledWith("/acme/orders");
  });

  it("goes home instead of to an address on another site", async () => {
    login.mockResolvedValue({});
    renderInBangla(<SignInForm nextPath="//evil.com" />);
    await fillAndSubmit("rahim@example.com", "secret-password");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the wrong-credentials message when the API answers 401", async () => {
    login.mockRejectedValue(refusal(401, "UNAUTHENTICATED", "errors.invalid_credentials"));
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("01712345678", "wrong-password");
    expect((await screen.findByRole("alert")).textContent).toBe(
      banglaText("errors.invalid_credentials"),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows how many minutes to wait when the API answers 429 with Retry-After", async () => {
    login.mockRejectedValue(refusal(429, "RATE_LIMITED", "errors.rate_limited", 600));
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("01712345678", "secret-password");
    expect((await screen.findByRole("alert")).textContent).toContain("10");
    expect((await screen.findByRole("alert")).textContent).toContain("মিনিট");
  });

  it("shows the account-locked message for a locked account", async () => {
    login.mockRejectedValue(refusal(403, "FORBIDDEN", "errors.account_locked"));
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("01712345678", "secret-password");
    expect((await screen.findByRole("alert")).textContent).toContain("Example");
  });

  it("falls back to the generic error for a message key it does not know", async () => {
    login.mockRejectedValue(refusal(500, "INTERNAL", "errors.something_new"));
    renderInBangla(<SignInForm nextPath="/" />);
    await fillAndSubmit("01712345678", "secret-password");
    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("errors.internal"));
  });

  it("has a password toggle with an accessible name that reveals the password", async () => {
    renderInBangla(<SignInForm nextPath="/" />);
    const user = userEvent.setup();
    const password = screen.getByLabelText(banglaText("auth.field.password"), { exact: false });
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: banglaText("auth.password.show") }));
    expect(password.getAttribute("type")).toBe("text");
    expect(screen.getByRole("button", { name: banglaText("auth.password.hide") })).not.toBeNull();
  });
});
