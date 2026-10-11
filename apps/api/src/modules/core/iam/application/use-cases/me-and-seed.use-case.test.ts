import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  aRegistration,
  createIamWorld,
  TEST_PASSWORD,
} from "../../../../../test-support/iam-world.js";
import { DomainRuleError } from "../../domain/errors.js";

describe("GetMeUseCase and UpdateMeUseCase", () => {
  it("returns the signed-in user", async () => {
    const world = createIamWorld();
    const { user } = await world.registerUser.execute(aRegistration());

    const me = await world.getMe.execute({ userId: user.userId });

    expect(me.email).toBe("rahim@example.com");
  });

  it("treats a token for a missing user as an invalid session", async () => {
    const world = createIamWorld();

    await expect(world.getMe.execute({ userId: newId() as UserId })).rejects.toBeInstanceOf(
      DomainRuleError,
    );
  });

  it("changes the name and language of the own profile", async () => {
    const world = createIamWorld();
    const { user } = await world.registerUser.execute(aRegistration());

    const updated = await world.updateMe.execute({
      userId: user.userId,
      name: "Karim Ali",
      preferredLocale: "en",
      version: user.version,
    });

    expect(updated).toMatchObject({ name: "Karim Ali", preferredLocale: "en", version: 2 });
  });
});

describe("EnsurePlatformAdminUseCase", () => {
  const seed = { email: "Admin@Example.com", password: "a long seeded passphrase" };

  it("creates the user and a SUPER_ADMIN operator on the first run", async () => {
    const world = createIamWorld();

    const result = await world.ensurePlatformAdmin.execute(seed);

    expect(result).toEqual({ isUserCreated: true, isOperatorCreated: true });
    const [operator] = [...world.operators.operators.values()];
    expect(operator?.platformRoles).toEqual(["SUPER_ADMIN"]);
    expect([...world.users.users.values()][0]?.email).toBe("admin@example.com");
  });

  it("changes nothing on a second run and never resets the password", async () => {
    const world = createIamWorld();
    await world.ensurePlatformAdmin.execute(seed);
    const before = [...world.users.users.values()][0]?.passwordHash;

    const result = await world.ensurePlatformAdmin.execute({
      ...seed,
      password: "a different passphrase",
    });

    expect(result).toEqual({ isUserCreated: false, isOperatorCreated: false });
    expect(world.users.users.size).toBe(1);
    expect(world.operators.operators.size).toBe(1);
    expect([...world.users.users.values()][0]?.passwordHash).toBe(before);
  });

  it("adds the missing operator to an existing user whose own password was given, without touching it", async () => {
    const world = createIamWorld();
    await world.registerUser.execute(aRegistration({ email: "admin@example.com" }));
    const before = [...world.users.users.values()][0]?.passwordHash;

    const result = await world.ensurePlatformAdmin.execute({ ...seed, password: TEST_PASSWORD });

    expect(result).toEqual({ isUserCreated: false, isOperatorCreated: true });
    expect([...world.users.users.values()][0]?.passwordHash).toBe(before);
  });

  it("creates no operator for an existing account the seed password does not open", async () => {
    const world = createIamWorld();
    await world.registerUser.execute(aRegistration({ email: "admin@example.com" }));

    const result = await world.ensurePlatformAdmin.execute(seed);

    expect(result).toEqual({ refusal: "PASSWORD_MISMATCH" });
    expect(world.operators.operators.size).toBe(0);
    expect(world.seededOperatorAudit.seededOperatorIds).toEqual([]);
  });

  it("audits the operator it creates, and only that one", async () => {
    const world = createIamWorld();

    await world.ensurePlatformAdmin.execute(seed);
    await world.ensurePlatformAdmin.execute(seed);

    const [operator] = [...world.operators.operators.values()];
    expect(world.seededOperatorAudit.seededOperatorIds).toEqual([operator?.platformOperatorId]);
  });

  it("refuses a seed password that breaks the password policy", async () => {
    const world = createIamWorld();

    await expect(
      world.ensurePlatformAdmin.execute({ email: "admin@example.com", password: "short" }),
    ).rejects.toBeInstanceOf(DomainRuleError);
  });
});
