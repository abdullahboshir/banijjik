import { newId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import {
  initializeModels,
  withTransaction,
  type DatabaseConnections,
} from "../../../../kernel/db/index.js";
import { DuplicateIdentifierError } from "../domain/errors.js";
import { PlatformOperator } from "../domain/platform-operator.entity.js";
import { RefreshSession } from "../domain/refresh-session.entity.js";
import { User } from "../domain/user.entity.js";
import { MongoPlatformOperatorRepository } from "./mongo-platform-operator.repository.js";
import { MongoRefreshSessionRepository } from "./mongo-refresh-session.repository.js";
import { MongoUserRepository } from "./mongo-user.repository.js";
import { registerIamModels } from "./register-iam-models.js";

registerIamModels();

const NOW = new Date("2026-10-11T08:00:00.000Z");
const users = new MongoUserRepository();
const sessions = new MongoRefreshSessionRepository();
const operators = new MongoPlatformOperatorRepository();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function aUser(overrides: { email?: string; phoneE164?: string } = {}): User {
  return User.create({ name: "Rahim", passwordHash: "stored-hash", now: NOW, ...overrides });
}

function aSession(userId: UserId, tokenHash: string = newId()): RefreshSession {
  return RefreshSession.openFamily({
    userId,
    tokenHash,
    now: NOW,
    tokenTtlDays: 30,
    familyMaxDays: 90,
  });
}

describe("MongoUserRepository", () => {
  it("stores a user and finds it by id, email and phone without any Mongo internals", async () => {
    const user = aUser({ email: "find@example.com", phoneE164: "+8801711000001" });
    await users.insert(user);

    const byId = await users.findById(user.userId);
    const byEmail = await users.findByEmail("find@example.com");
    const byPhone = await users.findByPhone("+8801711000001");

    expect(byId).toMatchObject({ userId: user.userId, name: "Rahim", version: 1 });
    expect(byEmail?.userId).toBe(user.userId);
    expect(byPhone?.userId).toBe(user.userId);
    expect(Object.keys(byId ?? {})).not.toContain("_id");
  });

  it("returns undefined for an unknown user", async () => {
    await expect(users.findByEmail("nobody@example.com")).resolves.toBeUndefined();
  });

  it("reports a taken email as DuplicateIdentifierError on the email field", async () => {
    await users.insert(aUser({ email: "dup@example.com" }));

    const error = await users.insert(aUser({ email: "dup@example.com" })).catch((caught) => caught);

    expect(error).toBeInstanceOf(DuplicateIdentifierError);
    expect(error.details).toEqual({ field: "email" });
  });

  it("reports a taken phone number as DuplicateIdentifierError on the phone field", async () => {
    await users.insert(aUser({ phoneE164: "+8801711000002" }));

    const error = await users
      .insert(aUser({ phoneE164: "+8801711000002" }))
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(DuplicateIdentifierError);
    expect(error.details).toEqual({ field: "phone" });
  });

  it("allows many users without an email, because the unique index is partial", async () => {
    await users.insert(aUser({ phoneE164: "+8801711000003" }));
    await users.insert(aUser({ phoneE164: "+8801711000004" }));

    await expect(users.findByPhone("+8801711000004")).resolves.toBeDefined();
  });

  it("saves a profile change and bumps the version", async () => {
    const user = aUser({ email: "edit@example.com" });
    await users.insert(user);

    const saved = await users.saveProfile(
      user.withProfile({ name: "Karim", preferredLocale: "en" }),
      1,
    );

    expect(saved).toMatchObject({ name: "Karim", preferredLocale: "en", version: 2 });
  });

  it("rejects a stale version with a 409 CONFLICT carrying the current version", async () => {
    const user = aUser({ email: "stale@example.com" });
    await users.insert(user);
    await users.saveProfile(user.withProfile({ name: "First" }), 1);

    const error = await users
      .saveProfile(user.withProfile({ name: "Second" }), 1)
      .catch((caught) => caught);

    expect(error).toMatchObject({ code: "CONFLICT", details: { currentVersion: 2 } });
  });

  it("records the last login without changing the version", async () => {
    const user = aUser({ email: "login@example.com" });
    await users.insert(user);

    await users.recordLogin(user.userId, NOW);

    const stored = await users.findById(user.userId);
    expect(stored?.lastLoginAt).toEqual(NOW);
    expect(stored?.version).toBe(1);
  });

  it("rolls the user back with the rest of a failed transaction", async () => {
    const user = aUser({ email: "rollback@example.com" });

    await withTransaction(async () => {
      await users.insert(user);
      throw new Error("abort on purpose");
    }).catch(() => undefined);

    await expect(users.findById(user.userId)).resolves.toBeUndefined();
  });
});

describe("MongoRefreshSessionRepository", () => {
  it("stores a session and finds it by token hash", async () => {
    const session = aSession(newId() as UserId, "hash-find");
    await sessions.insert(session);

    const found = await sessions.findByTokenHash("hash-find");

    expect(found).toMatchObject({
      refreshSessionId: session.refreshSessionId,
      familyId: session.familyId,
      rotatedAt: undefined,
      revokedAt: undefined,
    });
  });

  it("marks a session rotated once; a second call reports that it lost", async () => {
    const session = aSession(newId() as UserId);
    await sessions.insert(session);

    const first = await sessions.markRotated(session.refreshSessionId, newId(), NOW);
    const second = await sessions.markRotated(session.refreshSessionId, newId(), NOW);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("lets exactly one of many concurrent rotations win", async () => {
    const session = aSession(newId() as UserId);
    await sessions.insert(session);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sessions.markRotated(session.refreshSessionId, newId(), NOW),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not rotate a revoked session", async () => {
    const session = aSession(newId() as UserId);
    await sessions.insert(session);
    await sessions.revoke(session.refreshSessionId, NOW);

    await expect(sessions.markRotated(session.refreshSessionId, newId(), NOW)).resolves.toBe(false);
  });

  it("revokes a whole family and leaves other families alone", async () => {
    const userId = newId() as UserId;
    const first = aSession(userId, "family-a");
    const next = first.continueFamily({ tokenHash: "family-b", now: NOW, tokenTtlDays: 30 });
    const other = aSession(userId, "family-other");
    for (const session of [first, next, other]) await sessions.insert(session);

    await sessions.revokeFamily(first.familyId, NOW);

    expect((await sessions.findByTokenHash("family-a"))?.isRevoked()).toBe(true);
    expect((await sessions.findByTokenHash("family-b"))?.isRevoked()).toBe(true);
    expect((await sessions.findByTokenHash("family-other"))?.isRevoked()).toBe(false);
  });

  it("revokes every session of one user only", async () => {
    const userId = newId() as UserId;
    const someoneElse = newId() as UserId;
    await sessions.insert(aSession(userId, "user-a"));
    await sessions.insert(aSession(userId, "user-b"));
    await sessions.insert(aSession(someoneElse, "else-a"));

    await sessions.revokeAllForUser(userId, NOW);

    expect((await sessions.findByTokenHash("user-a"))?.isRevoked()).toBe(true);
    expect((await sessions.findByTokenHash("user-b"))?.isRevoked()).toBe(true);
    expect((await sessions.findByTokenHash("else-a"))?.isRevoked()).toBe(false);
  });
});

describe("MongoPlatformOperatorRepository", () => {
  it("stores an operator once per user", async () => {
    const userId = newId() as UserId;
    await operators.insert(PlatformOperator.superAdmin(userId, NOW));

    const found = await operators.findByUserId(userId);
    const duplicate = await operators
      .insert(PlatformOperator.superAdmin(userId, NOW))
      .catch((caught) => caught);

    expect(found?.platformRoles).toEqual(["SUPER_ADMIN"]);
    expect(duplicate).toBeInstanceOf(Error);
  });
});
