import type { UserStatus } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import {
  aRegistration,
  createIamWorld,
  TEST_PASSWORD,
  type IamWorld,
} from "../../../../../test-support/iam-world.js";
import { DomainRuleError, DuplicateIdentifierError } from "../../domain/errors.js";
import { User } from "../../domain/user.entity.js";

const CLIENT = { userAgent: "test-agent", ipAddress: "203.0.113.5" };

async function catchRuleError(action: Promise<unknown>): Promise<DomainRuleError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof DomainRuleError) return error;
    throw error;
  }
  throw new Error("expected a DomainRuleError");
}

function setStatus(world: IamWorld, status: UserStatus): void {
  const stored = world.users.users.values().next().value;
  if (stored === undefined) throw new Error("expected a stored user");
  world.users.replace(User.restore({ ...stored, status }));
}

describe("RegisterUserUseCase", () => {
  it("stores the user and a first session, and returns tokens for the cookies", async () => {
    const world = createIamWorld();

    const result = await world.registerUser.execute(aRegistration());

    expect(world.users.users.size).toBe(1);
    expect(world.sessions.sessions.size).toBe(1);
    expect(result.user.email).toBe("rahim@example.com");
    expect(result.issued.refreshToken.length).toBeGreaterThan(30);
    expect(result.issued.accessToken).toContain("access-token-for-");
  });

  it("never stores the refresh token itself, only its hash", async () => {
    const world = createIamWorld();

    const result = await world.registerUser.execute(aRegistration());

    const [session] = [...world.sessions.sessions.values()];
    expect(session?.tokenHash).not.toBe(result.issued.refreshToken);
    expect(JSON.stringify([...world.sessions.sessions.values()])).not.toContain(
      result.issued.refreshToken,
    );
  });

  it("hashes the password and stores no plain text", async () => {
    const world = createIamWorld();

    await world.registerUser.execute(aRegistration());

    const [user] = [...world.users.users.values()];
    expect(user?.passwordHash).toBe(`fake-hash:${TEST_PASSWORD}`);
  });

  it("rejects a second account with the same email", async () => {
    const world = createIamWorld();
    await world.registerUser.execute(aRegistration());

    const error = await catchRuleError(world.registerUser.execute(aRegistration()));

    expect(error).toBeInstanceOf(DuplicateIdentifierError);
    expect(error.details).toEqual({ field: "email" });
  });

  it("rejects a second account with the same phone number", async () => {
    const world = createIamWorld();
    const input = aRegistration({ email: undefined, phoneE164: "+8801712345678" });
    await world.registerUser.execute(input);

    const error = await catchRuleError(world.registerUser.execute({ ...input, name: "Karim Ali" }));

    expect(error.details).toEqual({ field: "phone" });
  });

  it("rejects a request with neither email nor phone before hashing anything", async () => {
    const world = createIamWorld();

    const error = await catchRuleError(
      world.registerUser.execute(aRegistration({ email: undefined })),
    );

    expect(error.details).toEqual({
      fields: [{ path: "email", messageKey: "validation.identifier_required" }],
    });
    expect(world.users.users.size).toBe(0);
  });

  it("rejects a password that is too short", async () => {
    const world = createIamWorld();

    const error = await catchRuleError(
      world.registerUser.execute(aRegistration({ password: "short" })),
    );

    expect(error.details).toEqual({
      fields: [{ path: "password", messageKey: "validation.password_too_short" }],
    });
  });

  it("rejects a password equal to the email", async () => {
    const world = createIamWorld();

    const error = await catchRuleError(
      world.registerUser.execute(aRegistration({ password: "rahim@example.com" })),
    );

    expect(error.details).toEqual({
      fields: [{ path: "password", messageKey: "validation.password_too_similar" }],
    });
  });
});

describe("LoginUseCase", () => {
  async function registeredWorld() {
    const world = createIamWorld();
    await world.registerUser.execute(aRegistration());
    return world;
  }

  const rightLogin = {
    identifier: { kind: "EMAIL", value: "rahim@example.com" },
    password: TEST_PASSWORD,
    client: CLIENT,
  } as const;

  it("signs in with the right email and password and starts a new family", async () => {
    const world = await registeredWorld();

    const result = await world.login.execute(rightLogin);

    expect(result.user.email).toBe("rahim@example.com");
    expect(world.sessions.sessions.size).toBe(2);
    expect(world.users.users.values().next().value?.lastLoginAt).toEqual(world.clock.now());
  });

  it("signs in by phone number", async () => {
    const world = createIamWorld();
    await world.registerUser.execute(
      aRegistration({ email: undefined, phoneE164: "+8801712345678" }),
    );

    const result = await world.login.execute({
      identifier: { kind: "PHONE", value: "+8801712345678" },
      password: TEST_PASSWORD,
      client: CLIENT,
    });

    expect(result.user.phoneE164).toBe("+8801712345678");
  });

  it("gives a wrong password and an unknown user the same error", async () => {
    const world = await registeredWorld();

    const wrongPassword = await catchRuleError(
      world.login.execute({ ...rightLogin, password: "not the password" }),
    );
    const unknownUser = await catchRuleError(
      world.login.execute({
        ...rightLogin,
        identifier: { kind: "EMAIL", value: "nobody@example.com" },
      }),
    );

    expect(unknownUser.code).toBe("UNAUTHENTICATED");
    expect(unknownUser.messageKey).toBe("errors.invalid_credentials");
    expect({
      code: wrongPassword.code,
      messageKey: wrongPassword.messageKey,
      details: wrongPassword.details,
    }).toEqual({
      code: unknownUser.code,
      messageKey: unknownUser.messageKey,
      details: unknownUser.details,
    });
  });

  it("verifies a dummy hash when the user does not exist, so the work is the same", async () => {
    const world = await registeredWorld();
    world.hasher.verifiedHashes.length = 0;

    await catchRuleError(
      world.login.execute({
        ...rightLogin,
        identifier: { kind: "EMAIL", value: "nobody@example.com" },
      }),
    );

    expect(world.hasher.verifiedHashes).toEqual([
      "fake-hash:dummy-password-for-constant-time-login",
    ]);
  });

  it.each([
    ["LOCKED", "errors.account_locked"],
    ["DISABLED", "errors.account_disabled"],
  ] as const)("refuses a %s user who knows the password with %s", async (status, messageKey) => {
    const world = await registeredWorld();
    setStatus(world, status);

    const error = await catchRuleError(world.login.execute(rightLogin));

    expect(error.code).toBe("FORBIDDEN");
    expect(error.messageKey).toBe(messageKey);
  });

  it("does not reveal a locked account to someone who guesses the password wrong", async () => {
    const world = await registeredWorld();
    setStatus(world, "LOCKED");

    const error = await catchRuleError(
      world.login.execute({ ...rightLogin, password: "wrong one" }),
    );

    expect(error.messageKey).toBe("errors.invalid_credentials");
  });

  it("answers RATE_LIMITED on the sixth attempt for one identifier", async () => {
    const world = await registeredWorld();
    const wrong = { ...rightLogin, password: "wrong password" };
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await catchRuleError(world.login.execute(wrong));
    }

    const error = await catchRuleError(world.login.execute(rightLogin));

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(60);
  });

  it("clears the failure count after a successful login", async () => {
    const world = await registeredWorld();
    const wrong = { ...rightLogin, password: "wrong password" };
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await catchRuleError(world.login.execute(wrong));
    }
    await world.login.execute(rightLogin);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const error = await catchRuleError(world.login.execute(wrong));
      expect(error.code).toBe("UNAUTHENTICATED");
    }
  });
});
