import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import { User, type NewUserInput } from "./user.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");

function newUserInput(overrides: Partial<NewUserInput> = {}): NewUserInput {
  return { name: "Rahim Uddin", passwordHash: "hash", now: NOW, ...overrides };
}

function catchRuleError(action: () => unknown): DomainRuleError {
  try {
    action();
  } catch (error) {
    if (error instanceof DomainRuleError) return error;
    throw error;
  }
  throw new Error("expected a DomainRuleError");
}

describe("User.create", () => {
  it("needs an email or a phone number", () => {
    const error = catchRuleError(() => User.create(newUserInput()));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual({
      fields: [{ path: "email", messageKey: "validation.identifier_required" }],
    });
  });

  it("accepts a phone number without an email", () => {
    const user = User.create(newUserInput({ phoneE164: "+8801712345678" }));

    expect(user.email).toBeUndefined();
    expect(user.phoneE164).toBe("+8801712345678");
  });

  it("lower-cases and trims the email", () => {
    const user = User.create(newUserInput({ email: "  Rahim@Example.COM " }));

    expect(user.email).toBe("rahim@example.com");
  });

  it("rejects a phone number that is not E.164", () => {
    const error = catchRuleError(() => User.create(newUserInput({ phoneE164: "01712345678" })));

    expect(error.details).toEqual({
      fields: [{ path: "phone", messageKey: "validation.invalid_format" }],
    });
  });

  it("starts active, unverified, at version 1, with Bangla as the default language", () => {
    const user = User.create(newUserInput({ email: "a@example.com" }));

    expect(user).toMatchObject({
      status: "ACTIVE",
      version: 1,
      preferredLocale: "bn",
      emailVerifiedAt: undefined,
      phoneVerifiedAt: undefined,
    });
  });

  it("gives every user its own UUID v7", () => {
    const first = User.create(newUserInput({ email: "a@example.com" }));
    const second = User.create(newUserInput({ email: "b@example.com" }));

    expect(first.userId).not.toBe(second.userId);
    expect(first.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });
});

describe("User.assertCanAuthenticate", () => {
  it("lets an active user through", () => {
    const user = User.create(newUserInput({ email: "a@example.com" }));

    expect(() => user.assertCanAuthenticate()).not.toThrow();
  });

  it.each([
    ["LOCKED", "errors.account_locked"],
    ["DISABLED", "errors.account_disabled"],
  ] as const)("refuses a %s user with %s", (status, messageKey) => {
    const active = User.create(newUserInput({ email: "a@example.com" }));
    const user = User.restore({ ...active, status });

    const error = catchRuleError(() => user.assertCanAuthenticate());

    expect(error.code).toBe("FORBIDDEN");
    expect(error.messageKey).toBe(messageKey);
  });
});

describe("User.withProfile", () => {
  it("changes the name and language and leaves the rest alone", () => {
    const user = User.create(newUserInput({ email: "a@example.com" }));

    const edited = user.withProfile({ name: " Karim ", preferredLocale: "en" });

    expect(edited).toMatchObject({ name: "Karim", preferredLocale: "en", email: "a@example.com" });
    expect(edited.userId).toBe(user.userId);
  });

  it("rejects a blank name", () => {
    const user = User.create(newUserInput({ email: "a@example.com" }));

    expect(() => user.withProfile({ name: "   " })).toThrow(DomainRuleError);
  });
});
