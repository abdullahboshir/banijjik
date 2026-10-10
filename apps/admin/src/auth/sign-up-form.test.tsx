// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";
import { banglaText, renderInBangla } from "./test-helpers";

const { replace, register } = vi.hoisted(() => ({ replace: vi.fn(), register: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../lib/api/auth-api", () => ({ register }));

const { SignUpForm } = await import("./sign-up-form");

function validationRefusal(fields: { path: string; messageKey: string }[]): ApiError {
  return new ApiError({
    status: 400,
    code: "VALIDATION_ERROR",
    messageKey: "errors.validation_error",
    details: { fields },
  });
}

async function fillAndSubmit(name: string, identifier: string, password: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(banglaText("auth.field.name"), { exact: false }), name);
  await user.type(
    screen.getByLabelText(banglaText("auth.field.identifier"), { exact: false }),
    identifier,
  );
  await user.type(
    screen.getByLabelText(banglaText("auth.field.password"), { exact: false }),
    password,
  );
  await user.click(screen.getByRole("button", { name: banglaText("auth.signUp.submit") }));
}

beforeEach(() => {
  replace.mockReset();
  register.mockReset();
});

describe("SignUpForm", () => {
  it("asks for every field before calling the API", async () => {
    renderInBangla(<SignUpForm nextPath="/" />);
    await userEvent.click(screen.getByRole("button", { name: banglaText("auth.signUp.submit") }));
    expect(screen.getAllByText(banglaText("validation.required"))).toHaveLength(2);
    expect(screen.getByText(banglaText("validation.identifier_required"))).not.toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it("sends a phone number as phone and an email as email, with the screen language", async () => {
    register.mockResolvedValue({});
    renderInBangla(<SignUpForm nextPath="/acme" />);
    await fillAndSubmit("রহিম উদ্দিন", "01712345678", "long-enough-password");
    expect(register).toHaveBeenCalledWith({
      name: "রহিম উদ্দিন",
      phone: "01712345678",
      password: "long-enough-password",
      preferredLocale: "bn",
    });
    expect(replace).toHaveBeenCalledWith("/acme");
  });

  it("puts API field errors on the field named by the path", async () => {
    register.mockRejectedValue(
      validationRefusal([{ path: "password", messageKey: "validation.password_too_short" }]),
    );
    renderInBangla(<SignUpForm nextPath="/" />);
    await fillAndSubmit("Rahim", "rahim@example.com", "short");
    const message = await screen.findByText(banglaText("validation.password_too_short"));
    const passwordInput = screen.getByLabelText(banglaText("auth.field.password"), {
      exact: false,
    });
    expect(passwordInput.getAttribute("aria-describedby")).toBe(message.id);
    expect(passwordInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("maps an email error from the API to the identifier field", async () => {
    register.mockRejectedValue(
      validationRefusal([{ path: "email", messageKey: "validation.invalid_format" }]),
    );
    renderInBangla(<SignUpForm nextPath="/" />);
    await fillAndSubmit("Rahim", "rahim@example.com", "long-enough-password");
    const message = await screen.findByText(banglaText("validation.invalid_format"));
    const identifierInput = screen.getByLabelText(banglaText("auth.field.identifier"), {
      exact: false,
    });
    expect(identifierInput.getAttribute("aria-describedby")).toContain(message.id);
  });

  it("shows a duplicate account on the identifier field", async () => {
    register.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "DUPLICATE",
        messageKey: "errors.duplicate",
        details: { field: "email" },
      }),
    );
    renderInBangla(<SignUpForm nextPath="/" />);
    await fillAndSubmit("Rahim", "rahim@example.com", "long-enough-password");
    const message = await screen.findByText(banglaText("errors.duplicate"));
    const identifierInput = screen.getByLabelText(banglaText("auth.field.identifier"), {
      exact: false,
    });
    expect(identifierInput.getAttribute("aria-describedby")).toContain(message.id);
    expect(replace).not.toHaveBeenCalled();
  });
});
