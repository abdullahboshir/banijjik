import { describe, expect, it } from "vitest";
import {
  aRegistration,
  createIamWorld,
  type IamWorld,
} from "../../../../../test-support/iam-world.js";
import { RefreshRaceError, DomainRuleError } from "../../domain/errors.js";
import { User } from "../../domain/user.entity.js";
import { hashRefreshToken } from "../refresh-token-secret.js";

const CLIENT = { userAgent: "test-agent", ipAddress: "203.0.113.5" };

async function startSession(world: IamWorld): Promise<string> {
  const result = await world.registerUser.execute(aRegistration());
  return result.issued.refreshToken;
}

function refresh(world: IamWorld, refreshToken: string | undefined) {
  return world.refreshSession.execute({ refreshToken, client: CLIENT });
}

async function catchRuleError(action: Promise<unknown>): Promise<DomainRuleError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof DomainRuleError) return error;
    throw error;
  }
  throw new Error("expected a DomainRuleError");
}

function sessionOf(world: IamWorld, refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);
  return [...world.sessions.sessions.values()].find((session) => session.tokenHash === hash);
}

describe("RefreshSessionUseCase", () => {
  it("rotates a valid token: the old one is marked rotated and a new one is issued", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    world.clock.advanceSeconds(60);

    const issued = await refresh(world, first);

    expect(issued.refreshToken).not.toBe(first);
    expect(sessionOf(world, first)?.isRotated()).toBe(true);
    expect(sessionOf(world, issued.refreshToken)?.isRotated()).toBe(false);
    expect(sessionOf(world, issued.refreshToken)?.familyId).toBe(sessionOf(world, first)?.familyId);
  });

  it("slides the expiry to 30 days after the refresh", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    world.clock.advanceDays(10);

    const issued = await refresh(world, first);

    const expected = world.clock.now().getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(issued.refreshTokenExpiresAt.getTime()).toBe(expected);
  });

  it("treats an unknown, empty or missing token as not valid", async () => {
    const world = createIamWorld();
    await startSession(world);

    for (const token of ["never-issued", "", undefined]) {
      const error = await catchRuleError(refresh(world, token));
      expect(error.code).toBe("UNAUTHENTICATED");
      expect(error).not.toBeInstanceOf(RefreshRaceError);
    }
  });

  it("answers a token reused within 10 seconds with a race error and revokes nothing", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    const second = await refresh(world, first);
    world.clock.advanceSeconds(10);

    const error = await catchRuleError(refresh(world, first));

    expect(error).toBeInstanceOf(RefreshRaceError);
    expect(sessionOf(world, second.refreshToken)?.isRevoked()).toBe(false);
    await expect(refresh(world, second.refreshToken)).resolves.toBeDefined();
  });

  it("revokes the whole family when a rotated token is reused after 10 seconds", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    const second = await refresh(world, first);
    world.clock.advanceSeconds(11);

    const error = await catchRuleError(refresh(world, first));

    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error).not.toBeInstanceOf(RefreshRaceError);
    expect(sessionOf(world, second.refreshToken)?.isRevoked()).toBe(true);
    await expect(refresh(world, second.refreshToken)).rejects.toBeInstanceOf(DomainRuleError);
  });

  it("does not touch the sessions of other logins when one family is revoked", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    const otherLogin = await world.login.execute({
      identifier: { kind: "EMAIL", value: "rahim@example.com" },
      password: "correct horse battery staple",
      client: CLIENT,
    });
    await refresh(world, first);
    world.clock.advanceSeconds(11);
    await catchRuleError(refresh(world, first));

    expect(sessionOf(world, otherLogin.issued.refreshToken)?.isRevoked()).toBe(false);
  });

  it("rejects an expired token after 30 days without activity", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    world.clock.advanceDays(30);

    const error = await catchRuleError(refresh(world, first));

    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error).not.toBeInstanceOf(RefreshRaceError);
  });

  it("ends the family at 90 days even for a user who is active every 25 days", async () => {
    const world = createIamWorld();
    let token = await startSession(world);
    for (let renewal = 0; renewal < 3; renewal += 1) {
      world.clock.advanceDays(25);
      token = (await refresh(world, token)).refreshToken;
    }
    world.clock.advanceDays(25);

    const error = await catchRuleError(refresh(world, token));

    expect(error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a revoked token", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    await world.logout.execute({ refreshToken: first });

    const error = await catchRuleError(refresh(world, first));

    expect(error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["LOCKED", "errors.account_locked"],
    ["DISABLED", "errors.account_disabled"],
  ] as const)("refuses a %s user with %s and revokes the family", async (status, messageKey) => {
    const world = createIamWorld();
    const first = await startSession(world);
    const stored = world.users.users.values().next().value;
    if (stored === undefined) throw new Error("expected a stored user");
    world.users.replace(User.restore({ ...stored, status }));

    const error = await catchRuleError(refresh(world, first));

    expect(error.code).toBe("FORBIDDEN");
    expect(error.messageKey).toBe(messageKey);
    expect(sessionOf(world, first)?.isRevoked()).toBe(true);
  });

  it("fails when the user no longer exists", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    world.users.users.clear();

    const error = await catchRuleError(refresh(world, first));

    expect(error.code).toBe("UNAUTHENTICATED");
    expect(sessionOf(world, first)?.isRevoked()).toBe(true);
  });
});

describe("LogoutUseCase and LogoutAllUseCase", () => {
  it("logout revokes only the current session and tolerates a missing cookie", async () => {
    const world = createIamWorld();
    const first = await startSession(world);

    await world.logout.execute({ refreshToken: undefined });
    await world.logout.execute({ refreshToken: first });
    await world.logout.execute({ refreshToken: first });

    expect(sessionOf(world, first)?.isRevoked()).toBe(true);
  });

  it("logout-all revokes every session of the user", async () => {
    const world = createIamWorld();
    const first = await startSession(world);
    const otherDevice = await world.login.execute({
      identifier: { kind: "EMAIL", value: "rahim@example.com" },
      password: "correct horse battery staple",
      client: CLIENT,
    });
    const userId = otherDevice.user.userId;

    await world.logoutAll.execute({ userId });

    expect(sessionOf(world, first)?.isRevoked()).toBe(true);
    expect(sessionOf(world, otherDevice.issued.refreshToken)?.isRevoked()).toBe(true);
  });
});
